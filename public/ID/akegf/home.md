# AKEGF · Beranda

> ArKnights: Endfield Gachalog Format · v0.3

AKEGF menggunakan JSON UTF-8 untuk memindahkan riwayat perekrutan operator, pemesanan senjata, dan hadiah di Arknights: Endfield. Terinspirasi dari [UIGF](https://uigf.org/), satu berkas dapat memuat beberapa karakter dan server agar pemain dapat membawa riwayatnya saat berganti alat.

Cantumkan versi yang didukung dan tautan ke [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) di aplikasi. Lihat [Spesifikasi](/?plugin=akegf&id=standard) untuk aturan kolom dan [Pemeriksa format AKEGF](/?plugin=akegf&id=validator) untuk memeriksa hasil impor dan ekspor.

[Spesifikasi](/?plugin=akegf&id=standard) · [Pemeriksa format AKEGF](/?plugin=akegf&id=validator) · [Proyek mitra](/?plugin=akegf&id=partners)

## JSON Schema

[Unduh JSON Schema v0.3](/plugin/data/akegf/akegf-v0.3.schema.json) · [Contoh dengan beberapa karakter](/plugin/data/akegf/example.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AKEGF v0.3",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "info",
    "endfield"
  ],
  "properties": {
    "info": {
      "$ref": "#/$defs/info"
    },
    "endfield": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/account"
      },
      "minItems": 1
    }
  },
  "$defs": {
    "text": {
      "type": "string",
      "pattern": "\\S"
    },
    "info": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "version"
      ],
      "properties": {
        "version": {
          "const": "v0.3"
        },
        "export_app": {
          "$ref": "#/$defs/text"
        },
        "export_app_version": {
          "$ref": "#/$defs/text"
        },
        "export_timestamp": {
          "type": "integer",
          "minimum": 1000000000000,
          "maximum": 9999999999999,
          "description": "Unix 毫秒"
        }
      }
    },
    "account": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "uid",
        "list"
      ],
      "properties": {
        "region": {
          "enum": [
            "cn",
            "global"
          ],
          "default": "cn"
        },
        "server_id": {
          "$ref": "#/$defs/text"
        },
        "uid": {
          "$ref": "#/$defs/text",
          "description": "游戏角色 UID，以字符串保存"
        },
        "lang": {
          "$ref": "#/$defs/text"
        },
        "list": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/pull"
          }
        },
        "account_uid": {
          "$ref": "#/$defs/text",
          "description": "可选的绑定账号 UID"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "region": {
                "const": "global"
              }
            },
            "required": [
              "region"
            ]
          },
          "then": {
            "required": [
              "server_id"
            ]
          }
        }
      ]
    },
    "pull": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "pool_id",
        "item_name",
        "rarity",
        "gacha_ts"
      ],
      "properties": {
        "record_type": {
          "enum": [
            "char",
            "weapon"
          ]
        },
        "seq_id": {
          "$ref": "#/$defs/text"
        },
        "pool_id": {
          "$ref": "#/$defs/text"
        },
        "item_id": {
          "$ref": "#/$defs/text"
        },
        "gacha_ts": {
          "type": "integer",
          "minimum": 1000000000000,
          "maximum": 9999999999999,
          "description": "Unix 毫秒"
        },
        "rarity": {
          "type": "integer",
          "minimum": 1,
          "maximum": 99
        },
        "pool_name": {
          "$ref": "#/$defs/text"
        },
        "item_name": {
          "$ref": "#/$defs/text"
        },
        "pool_type": {
          "$ref": "#/$defs/text"
        },
        "weapon_type": {
          "$ref": "#/$defs/text"
        },
        "is_new": {
          "type": "boolean"
        },
        "is_free": {
          "type": "boolean"
        },
        "kind": {
          "type": "string",
          "pattern": "\\S",
          "description": "draw 为抽取，gift_intel_book 为寻访情报书，gift_operator_token 为干员信物，gift_weapon_box 为补充武库箱，gift_weapon 为赠送武器。保留其他官方类型，来源性质不明时使用 unknown。"
        },
        "name_text": {
          "$ref": "#/$defs/text"
        },
        "seq_id_source": {
          "enum": [
            "batch_end"
          ],
          "description": "由已知来源的批次末号和数组位置还原"
        },
        "gift_reward_label": {
          "$ref": "#/$defs/text",
          "description": "官方 giftRewardLabel，表示赠礼名称，例如篆玉赠礼。来源缺失时省略。"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "record_type": {
                "const": "weapon"
              }
            },
            "required": [
              "record_type"
            ]
          },
          "then": {
            "not": {
              "required": [
                "is_free"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "record_type": {
                "const": "char"
              }
            },
            "required": [
              "record_type"
            ]
          },
          "then": {
            "not": {
              "required": [
                "weapon_type"
              ]
            }
          }
        }
      ],
      "dependentRequired": {
        "seq_id_source": [
          "seq_id"
        ]
      }
    }
  }
}

```