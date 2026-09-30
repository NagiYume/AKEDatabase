(function() {
    const FORMULA_TO_MODTYPE = {
        Addition: 0,
        Multiplier: 1,
        FinalAddition: 3,
        FinalMultiplier: 4,
        BaseAddition: 5,
        BaseMultiplier: 6,
        BaseFinalAddition: 7,
        BaseFinalMultiplier: 8
    };

    const DEFAULT_ATTR_DISPLAY_ORDER = [0, 1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15];
    const MULTIPLIER_MODIFIER_TYPES = new Set([1, 4, 6, 8]);

    function compactNumber(value) {
        if (!Number.isFinite(value)) return String(value);
        return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
    }

    function analyzeAttrWithModifiers(baseValue, modifiers, attrType) {
        const relevant = (modifiers || []).filter(modifier => modifier.attrType === attrType && Number.isFinite(Number(modifier.attrValue)));
        let expression = compactNumber(baseValue);
        let value = baseValue;
        relevant.filter(modifier => modifier.modifierType === 9).forEach(modifier => {
            const operand = Number(modifier.attrValue);
            expression = `override(${compactNumber(operand)})`;
            value = operand;
        });
        const stages = [
            { type: 5, operator: '+', wrap: false },
            { type: 6, operator: '×', onePlus: true },
            { type: 7, operator: '+', wrap: false },
            { type: 8, operator: '×' },
            { type: 3, operator: '+', wrap: false },
            { type: 4, operator: '×' },
            { type: 0, operator: '+', wrap: false },
            { type: 1, operator: '×', onePlus: true }
        ];
        stages.forEach(stage => {
            const entries = relevant.filter(modifier => modifier.modifierType === stage.type);
            entries.forEach(modifier => {
                const operand = Number(modifier.attrValue);
                const term = stage.onePlus ? `(1 + ${compactNumber(operand)})` : compactNumber(operand);
                expression = stage.operator === '+' ? `(${expression} + ${term})` : `${expression} × ${term}`;
                value = stage.operator === '+' ? value + operand : value * (stage.onePlus ? 1 + operand : operand);
            });
        });
        return {
            rawValue: baseValue,
            value,
            changed: relevant.length > 0 && value !== baseValue,
            formula: `${expression} = ${compactNumber(value)}`,
            modifiers: relevant
        };
    }

    function computeAttrWithModifiers(baseValue, modifiers, attrType) {
        return analyzeAttrWithModifiers(baseValue, modifiers, attrType).value;
    }

    function combineModifiers(modifiers) {
        const groups = new Map();
        (modifiers || []).forEach(modifier => {
            const value = Number(modifier.attrValue);
            if (!Number.isFinite(value)) return;
            const key = `${modifier.attrType}:${modifier.modifierType}`;
            if (!groups.has(key)) groups.set(key, { ...modifier, attrValue: value });
            else {
                const current = groups.get(key);
                if (modifier.modifierType === 9) {
                    current.attrValue = value;
                } else if (modifier.modifierType === 1 || modifier.modifierType === 6) {
                    current.attrValue = (1 + current.attrValue) * (1 + value) - 1;
                } else if (modifier.modifierType === 4 || modifier.modifierType === 8) {
                    current.attrValue *= value;
                } else {
                    current.attrValue += value;
                }
            }
        });
        return Array.from(groups.values());
    }

    function pickLevelAttributes(levelDependentAttributes, enemyLevel) {
        const levelRows = levelDependentAttributes || [];
        for (const row of levelRows) {
            const attrs = row.attrs || [];
            const level = attrs.find(attr => attr.attrType === 0)?.attrValue || 0;
            if (level === enemyLevel) return attrs;
        }

        if (!levelRows.length) return [];
        const closestLevel = levelRows.reduce((best, row) => {
            const level = (row.attrs || []).find(attr => attr.attrType === 0)?.attrValue || 0;
            return Math.abs(level - enemyLevel) < Math.abs(best - enemyLevel) ? level : best;
        }, levelRows[0]?.attrs?.find(attr => attr.attrType === 0)?.attrValue || 0);

        return (levelRows.find(row => ((row.attrs || []).find(attr => attr.attrType === 0)?.attrValue || 0) === closestLevel)?.attrs) || [];
    }

    function getEnemyStatsAtLevel(attrTemplateData, enemyLevel, modifiers, options) {
        return getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers, options)?.values || null;
    }

    function getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers, options) {
        if (!attrTemplateData) return null;
        const opts = options || {};
        const displayOrder = opts.displayOrder || DEFAULT_ATTR_DISPLAY_ORDER;
        const excludedAttrTypes = new Set(opts.excludeAttrTypes || []);
        const getAttrName = opts.getAttrName || (attrType => window.akeI18n.t('modules.character.attributeFallback', { name: attrType }));
        const baseAttrs = {};
        const baseSources = {};

        pickLevelAttributes(attrTemplateData.levelDependentAttributes || [], enemyLevel).forEach(attr => {
            baseAttrs[attr.attrType] = attr.attrValue;
            baseSources[attr.attrType] = 'levelDependent';
        });

        (attrTemplateData.levelIndependentAttributes?.attrs || []).forEach(attr => {
            if (baseAttrs[attr.attrType] === undefined) {
                baseAttrs[attr.attrType] = attr.attrValue;
                baseSources[attr.attrType] = 'levelIndependent';
            }
        });

        if (modifiers && modifiers.length > 0) {
            Object.keys(baseAttrs).forEach(key => {
                const attrType = parseInt(key, 10);
                baseAttrs[attrType] = computeAttrWithModifiers(baseAttrs[attrType], modifiers, attrType);
            });

            if (opts.includeModifierOnlyAttrs) {
                new Set(modifiers.map(modifier => modifier.attrType)).forEach(attrType => {
                    if (baseAttrs[attrType] !== undefined) return;
                    const attrModifiers = modifiers.filter(modifier => modifier.attrType === attrType);
                    const baseValue = attrModifiers.every(modifier => MULTIPLIER_MODIFIER_TYPES.has(modifier.modifierType)) ? 1 : 0;
                    baseAttrs[attrType] = computeAttrWithModifiers(baseValue, modifiers, attrType);
                    baseSources[attrType] = 'modifierOnly';
                });
            }
        }

        const result = {};
        const details = {};
        const addResult = attrType => {
            const name = getAttrName(attrType);
            const finalValue = baseAttrs[attrType];
            const relevant = (modifiers || []).filter(modifier => modifier.attrType === attrType);
            let rawValue = finalValue;
            if (relevant.length) {
                if (baseSources[attrType] === 'modifierOnly') rawValue = relevant.every(modifier => MULTIPLIER_MODIFIER_TYPES.has(modifier.modifierType)) ? 1 : 0;
                else {
                    const levelAttrs = pickLevelAttributes(attrTemplateData.levelDependentAttributes || [], enemyLevel);
                    rawValue = levelAttrs.find(attr => attr.attrType === attrType)?.attrValue
                        ?? attrTemplateData.levelIndependentAttributes?.attrs?.find(attr => attr.attrType === attrType)?.attrValue
                        ?? finalValue;
                }
            }
            result[name] = finalValue;
            details[name] = { ...analyzeAttrWithModifiers(rawValue, modifiers, attrType), name, attrType, baseSource: baseSources[attrType] };
        };
        displayOrder.forEach(attrType => {
            if (excludedAttrTypes.has(attrType)) return;
            if (baseAttrs[attrType] !== undefined) addResult(attrType);
        });
        Object.keys(baseAttrs).forEach(key => {
            const attrType = parseInt(key, 10);
            if (!excludedAttrTypes.has(attrType) && !displayOrder.includes(attrType) && attrType >= 4) {
                addResult(attrType);
            }
        });
        return { values: result, details };
    }

    window.AKEStats = {
        FORMULA_TO_MODTYPE,
        DEFAULT_ATTR_DISPLAY_ORDER,
        analyzeAttrWithModifiers,
        combineModifiers,
        computeAttrWithModifiers,
        getEnemyStatsAtLevel,
        getEnemyStatDetailsAtLevel
    };
})();
