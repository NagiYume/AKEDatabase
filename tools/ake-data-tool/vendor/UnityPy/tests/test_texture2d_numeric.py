import struct
from types import SimpleNamespace

import pytest

from UnityPy.classes.legacy_patch.Texture2D import _Texture2D_get_image_data
from UnityPy.enums import TextureFormat as TF
from UnityPy.export.Texture2DConverter import get_image_from_texture2d, parse_image_data


def decode(data, width, texture_format, height=1, flip=False):
    return parse_image_data(data, width, height, texture_format, (2021, 3, 0, 0), 0, flip=flip)


@pytest.mark.parametrize(
    "fmt,component,values,expected",
    [
        (TF.RG16, "B", [1, 2, 254, 255], [(1, 2, 0), (254, 255, 0)]),
        (TF.RG32, "H", [65535, 0, 32768, 65535], [(255, 0, 0), (128, 255, 0)]),
        (TF.RG16_SIGNED, "b", [-128, 127, 64, -1], [(0, 255, 0), (129, 0, 0)]),
        (TF.RG32_SIGNED, "h", [-32768, 32767, 16384, -1], [(0, 255, 0), (128, 0, 0)]),
    ],
)
def test_rg_channels_and_component_width(fmt, component, values, expected):
    data = struct.pack("<4" + component, *values)
    # A trailing mip must not be read as part of the base level.
    image = decode(data + b"\xff" * 16, 2, fmt)
    assert [image.getpixel((i, 0)) for i in range(2)] == expected


@pytest.mark.parametrize(
    "component,formats", [("e", (TF.RHalf, TF.RGHalf, TF.RGBAHalf)), ("f", (TF.RFloat, TF.RGFloat, TF.RGBAFloat))]
)
@pytest.mark.parametrize("channels", [1, 2, 4])
def test_float_pixel_stride_alpha_and_little_endian(component, formats, channels):
    if channels == 1:
        values, expected = [1, 0.25], [(255, 0, 0), (64, 0, 0)]
    elif channels == 2:
        values, expected = [1, 0, 0.25, 0.75], [(255, 0, 0), (64, 191, 0)]
    else:
        values, expected = [1, 0, 0.5, 0.25, 0.125, 0.75, 0, 1], [(255, 0, 128, 64), (32, 191, 0, 255)]
    fmt = formats[{1: 0, 2: 1, 4: 2}[channels]]
    data = bytearray(struct.pack("<" + str(len(values)) + component, *values))
    original = bytes(data)
    image = decode(data + b"\0" * 8, 2, fmt)
    assert image.mode == ("RGBA" if channels == 4 else "RGB")
    assert [image.getpixel((i, 0)) for i in range(2)] == expected
    assert bytes(data) == original
    # Exercise the same format through a Texture2D's embedded and streamed data interface.
    tex = SimpleNamespace(m_Width=2, m_Height=1, m_TextureFormat=fmt, object_reader=None, get_image_data=lambda: data)
    assert get_image_from_texture2d(tex).tobytes() == image.tobytes()


@pytest.mark.parametrize("component,fmt", [("e", TF.RHalf), ("f", TF.RFloat)])
def test_float_hdr_and_nonfinite_preview(component, fmt):
    values = [-1, 0, 1, 2, float("nan"), float("inf"), -float("inf"), 0.5]
    data = struct.pack("<8" + component, *values)
    image = decode(data, 8, fmt)
    assert [image.getpixel((i, 0))[0] for i in range(8)] == [0, 0, 255, 255, 0, 255, 0, 128]
    assert struct.unpack("<8" + component, data)[3] == 2  # source still contains the HDR value


@pytest.mark.parametrize(
    "fmt,size",
    [
        (TF.RG16, 2),
        (TF.RG32, 4),
        (TF.RGHalf, 4),
        (TF.RGFloat, 8),
        (TF.RHalf, 2),
        (TF.RFloat, 4),
        (TF.RGBAHalf, 8),
        (TF.RGBAFloat, 16),
    ],
)
def test_truncated_numeric_texture(fmt, size):
    with pytest.raises(ValueError, match="data size"):
        decode(bytes(2 * size - 1), 2, fmt)


def test_numeric_texture_vertical_flip():
    raw = bytes([10, 20, 30, 40])
    image = decode(raw, 1, TF.RG16, height=2, flip=True)
    assert image.getpixel((0, 0)) == (30, 40, 0)
    assert image.getpixel((0, 1)) == (10, 20, 0)


def test_empty_texture_does_not_resolve_an_empty_stream_path():
    # Dynamic font atlases have no on-disk pixels; reading an empty path used to open the CWD.
    tex = SimpleNamespace(m_Width=0, m_Height=0)
    assert get_image_from_texture2d(tex).size == (0, 0)
    tex = SimpleNamespace(image_data=b"", m_StreamData=SimpleNamespace(path="", offset=0, size=0))
    with pytest.raises(ValueError, match="No image data"):
        _Texture2D_get_image_data(tex)
