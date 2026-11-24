# AKEGF · 首頁

> ArKnights: Endfield Gachalog Format · v0.4

AKEGF 將《明日方舟：終末地》的幹員尋訪、武器申領與贈禮逐筆保存為 UTF-8 JSON。參考 [UIGF](https://uigf.org/) 的經驗，一份檔案可涵蓋多個角色與伺服器，方便玩家更換工具時帶走完整紀錄。

應用程式請標明支援的版本並連至 [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home)。欄位定義見[標準化文件](/?plugin=akegf&id=standard)，匯入與匯出檢查見[AKEGF 格式校驗工具](/?plugin=akegf&id=validator)。

[標準化文件](/?plugin=akegf&id=standard) · [AKEGF 格式校驗工具](/?plugin=akegf&id=validator) · [合作專案](/?plugin=akegf&id=partners)

## JSON Schema

[下載 v0.4 JSON Schema](/plugin/data/akegf/akegf-v0.4.schema.json) · [多角色範例](/plugin/data/akegf/example.json)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AKEGF v0.4",
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
          "const": "v0.4"
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
      },
      "dependentRequired": {
        "export_provider": ["rsa_signature"],
        "rsa_signature": ["export_provider"]
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