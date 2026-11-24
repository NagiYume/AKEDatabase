# AKEGF · 终末地抽卡记录格式

>ArKnights: Endfield Gachalog Format

当前版本：v0.3

## 前言

为了统一不同应用、不同工具、不同账号间的抽卡记录导入导出行为，在参考了其他游戏社区的自定标准（[UIGF](https://uigf.org/)）后，我们决定为**明日方舟：终末地**制定一个统一的抽卡记录存储格式。不同的账号将能够以单个文件或字符串的形式进行表示，导入与导出操作对用户而言将变得史无前例的简单。

## 实现与认证

字段类型和读写规则见[标准化文档](https://www.akedata.wiki/?plugin=akegf&id=standard)。
如果您想将自己的项目接入AKEGF，可参阅[工具认证](https://www.akedata.wiki/?plugin=akegf&id=validator)，了解导入、导出和往返检查的要求。

>**AKEGF标准使用声明**：
>请在应用内提供跳转至 [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) 的超链接，声明支持 AKEGF 数据格式。
>仅包含导入或导出功能降低了用户数据的流通性，且将数据置于用户不可控的风险中，不符合 AKEGF 设计的初衷。

## JSON Schema

>AKEGF 提供下述 JSON Schema 以用于验证资料结构的正确性。

开发者务必遵循 Schema 内定义的字段类型。使用错误的类型可能会导致其他由强类型编程语言编写的工具在解析 JSON 文件时产生错误，进而导致数据转移失败。

为了避免这类问题，我们建议您针对 AKEGF 格式设计专用的数据结构。同时，设计相关的单元测试以确保导入导出的一致性。

我们也提供[AKEGF 格式校验工具](https://www.akedata.wiki/?plugin=akegf&id=validator)来帮助你校验 JSON 文件。

你也可以[下载 v0.3 JSON Schema](https://www.akedata.wiki/plugin/data/akegf/akegf-v0.3.schema.json)。

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