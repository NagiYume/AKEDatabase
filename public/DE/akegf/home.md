# AKEGF · Startseite

> ArKnights: Endfield Gachalog Format · v1.2

AKEGF überträgt Rekrutierungen, Waffenanforderungen und Geschenke aus Arknights: Endfield als UTF-8-JSON. Nach dem Vorbild von [UIGF](https://uigf.org/) fasst ein Archiv die Historien mehrerer Charaktere und Server zusammen, damit Spieler das Auswertungswerkzeug wechseln können.

Geben Sie in der Anwendung die unterstützte Version und einen Link zu [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) an. Feldregeln stehen in der [Spezifikation](/?plugin=akegf&id=standard); die [AKEGF-Formatprüfung](/?plugin=akegf&id=validator) erläutert den Test von Import und Export.

[Spezifikation](/?plugin=akegf&id=standard) · [AKEGF-Formatprüfung](/?plugin=akegf&id=validator) · [Partnerprojekte](/?plugin=akegf&id=partners)

## JSON Schema

[JSON-Schema v1.2 herunterladen](/plugin/data/akegf/akegf-v1.2.schema.json) · [Beispiel mit mehreren Charakteren](/plugin/data/akegf/example.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AKEGF v1.2",
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
        "version",
        "export_provider",
        "rsa_signature"
      ],
      "properties": {
        "version": {
          "const": "v1.2"
        },
        "export_app": {
          "$ref": "#/$defs/text"
        },
        "export_app_version": {
          "$ref": "#/$defs/text"
        },
        "export_provider": {
          "type": "string",
          "pattern": "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$(?![\\s\\S])",
          "description": "Export provider ID assigned by the AKEGF public key registry"
        },
        "rsa_signature": {
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\\.(?:[A-Za-z0-9_-]{341}[AQgw]|[A-Za-z0-9_-]{512}|[A-Za-z0-9_-]{682}[AEIMQUYcgkosw048])$(?![\\s\\S])",
          "description": "Key fingerprint and RSA-PSS signature as kid.signature, both unpadded base64url"
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
        "kind"
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
              "kind": {
                "const": "draw"
              }
            },
            "required": [
              "kind"
            ]
          },
          "then": {
            "required": [
              "pool_id",
              "item_name",
              "rarity",
              "gacha_ts"
            ]
          }
        },
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