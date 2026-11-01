"""VFS cursor shared with the tool's bounds-checked binary reader."""
from ..models import CancellationToken
from ..tablecfg_parser import BinaryCursor


class Reader(BinaryCursor):
    def __init__(self, data):
        super().__init__(data, CancellationToken())

    seek = BinaryCursor.move
    take = BinaryCursor.read

    def val(self, fmt):
        return self.number(fmt.removeprefix('<'))

    def integer(self):
        return self.number('i')

    def byte(self):
        return self.number('B')

    def prefixed_text(self):
        return self.text(prefixed=True)
