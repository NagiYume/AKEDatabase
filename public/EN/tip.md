AKEData has moved to www.akedata.wiki. The former domain, akedata.top, now redirects here.

# AKEData Version Changelog

### v1.2.15

#### Character icons and skill popups

- The Character Icon Generator now includes a `1024 × 1024` preset and custom width and height controls. With aspect-ratio locking enabled, the other dimension follows automatically; non-square canvases keep the original composition proportional and centered.
- The Skill with Attributes layout now selects background assets from the skill type and damage attribute, with independent toggles for the skill, background base, skill-type background, attribute color, character icon, rings, and decoration layers.
- Added a Character Skill Popup Generator with game-style rich text, link icons, skill parameters, branch skills, ultimate costs and cooldowns, plus leveled character talent and attribute nodes.
- Skill popups support editing original text and background images. While editing is enabled, preview and exported images receive a hidden locator watermark, and a separate Image Watermark Decoder is available.
- Watermark embedding and decoding now prioritize the image center, use stronger frequency-domain quantization, and retain a full-image fallback scan. The decoder accepts both selected files and pasted images.

#### Asset module

- Asset versions now parse both the game version and the Hotfix suffix after `@`. New-content detection uses the highest complete asset version instead of ignoring Hotfix differences.
- Added localized aliases for game Sprite directories. The asset directory, tree, quick jumps, and folder cards now show easier-to-recognize asset categories.
- New-content badges are shown at both folder and file level, and new items are prioritized in directories, search results, and file lists while preserving the selected file within its priority group.
- Quick jumps and the asset directory can now be collapsed independently on desktop and mobile, with consistent grouping on root and directory pages.

### v1.2.14

#### Asset module improvements

- Asset files now receive a “New” badge based on the highest valid game version in the unified asset index. Both new paths and overwritten existing paths in the current version are marked.
- Added a synchronized “New only” filter for desktop and mobile, filtering file cards, directory branches, and search results together.
- Added “Game icons” and “Game map” quick jumps on the root page and in both desktop and mobile asset directories.
- Version detection uses only the game version before `@` in each `version` value. The `1.4.4` baseline is not marked as new, and Hotfix values do not create separate version groups.

### v1.2.13

#### Unified asset index and Asset module

- Added a token-protected Asset module for browsing remote image and Json directories, previewing images, and downloading files.
- Remote `asset-sync-index` now describes image and Json revisions independently from the TableCfg game-data version in `version.json`.
- Asset synchronization no longer depends on `manifest.json` files inside Json directories; the runtime no longer generates local or remote manifests.

#### Data-loading architecture

- Startup scripts and dynamically loaded module scripts are prefetched in parallel and executed in their original order, reducing serial network waterfalls.
- Added a bounded-concurrency data loader with request deduplication, priority scheduling, batched Table loading, shared cancellation waits, and loading statistics.
- Large JSON payloads are parsed in a Worker. Text tables now look up localized values with Chinese fallback on demand instead of expanding a full merged copy.
- IndexedDB now gets only a short opportunity before a request proceeds to the network, and cache reads and writes are batched. Progress rendering is frame-scheduled.
- Service Worker registration runs in the background and no longer blocks the initial page.

#### Stability fixes

- Fixed dynamically prefetched module scripts being executed before their source Promise had resolved.
- Fixed the asset-index revision from being incorrectly coupled to the TableCfg `sharedRevision`; the two independent data-version systems no longer conflict.

### v1.2.12

#### Characters and skills

- Character directory entries now show weapon-type icons, and character details include a matching weapon-type tag.
- When hidden mode is enabled, raw fields for skill groups containing multiple skills now appear beneath the description of the skill they belong to and use the next description depth.
- In the Chinese interface, hidden field names are tokenized only at underscores and numeric suffixes, and the provided term explanations are assembled beneath the original field name. Concatenated fields without underscores are left intact.
- Cooldown, ATB, and ultimate-energy cost fields are omitted when every level is `0`, including hidden `atb` and `usp` fields.

#### Events

- Event details now include the in-game instructions from `InstructionBook`.
- Added reward details for check-ins, level rewards, event tasks, score milestones, return events, character trials, anniversary stages, and new-player benefits while retaining existing event and stage rewards.
- Supplemental instruction, reward, item, stage, and dungeon tables are loaded only after the matching event detail is opened. The event landing page no longer requests them in advance.
- Event overview images are now aligned to the right while preserving their original aspect ratio and existing display size.

#### Sidebars and resource versions

- Reduced the minimum width of the main and module sidebars. Entries with icons switch to icon-only display at narrow widths, and main-sidebar icons no longer disappear when the sidebar is collapsed.
- Added independent CSS versions for the light, dark, and eye-comfort themes in `version.json`, allowing unchanged theme resources to remain cached.

### v1.2.11

#### Secondary navigation and shared interface

- Rebuilt secondary navigation across the main query modules with consistent item layouts, active states, counts, version-change markers, search, filters, and desktop/mobile interactions.
- Introduced a shared interface layer for buttons, inputs, selects, switches, filters, cards, states, and tables, reducing visual and behavioral differences between modules.

#### Settings and presentation

- Redesigned the global settings and site announcement dialogs with clearer grouping and consistent light, dark, and eye-comfort themes.
- Standardized loading, empty, and error states. Shared table headers and body content are now centered by default.

### v1.2.10-1

#### Archive version comparison

- Only when using `Latest` data, Archive compares against the final Hotfix of the previous game version. Archives added in the current version are pinned and marked globally on the start overview and within their directory categories, while new entries appear first inside groups. Fixed historical versions do not show new-entry markers.

### v1.2.10

#### Archive

- Added the public Archive module. Its start page brings every in-game archive together with medium and category directories, full-text search across documents and transcripts, and archive-group deep links.
- Details render game-styled rich-text titles, illustrated documents, and original archive images. Images with protagonist variants can switch between the female and male versions.
- Multimedia archives currently provide line-by-line text transcripts only; this release does not load or play audio.

#### Browsing and display

- Archive directories work on desktop and mobile, with browsing and scroll-state restoration when returning to the module and long-image export for details.
- Improved rendering for redacted rich-text marks and standardized missing-image handling for archive icons, document images, and decorative images.

### v1.2.9

#### Miscellaneous and task center

- Added an independently extensible Miscellaneous module. Its first tools cover weekly tasks, Protocol Pass tasks, and activity tasks for Simulation Training, Contingency Contracts, Racing Dungeons, and Tournament completion.
- Protocol Pass tasks can be filtered by week and now show every level across all three reward tracks.

#### Icons and acquisition data

- Added a character icon generator for selecting a character and skill, previewing the composite, and downloading it as a PNG.
- Shops now expose unlock requirements and Material Dispatch levels, while equipment details include shop, mission, and map template-box sources. OEM map links are derived dynamically from LevelData only after they are clicked.

#### Experience and stability

- Standardized the fallback shown when images fail to load, and fixed independent Miscellaneous scrolling, mobile controls, and several task-reward layouts.
- The new combat-data module `v3_skill` and Buff-data module `v3_buff` remain under validation and are not available in this release.

### v1.2.8

#### Sidebars and layout

- The main sidebar and each module sidebar can now be resized by dragging, with their adjusted widths saved separately. At narrow widths, entries with icons collapse to icon-only mode, while entries without icons keep their names for identification.
- Global Settings and long-image export now occupy a dedicated bottom area and no longer overlap the module list.

#### Browsing state

- During the same browsing session, returning to a module restores its previously open page, item, and scroll position.
- Detail scroll positions are stored separately for different items in the same module. Refreshing the page clears these temporary states and returns to the starting page.

### v1.2.7

#### Dungeons and activities

- Dungeon details now show repeatable fixed and random rewards that consume Sanity, separately from first-clear rewards.
- Activity blocks on the overview timeline now use their exact start and end timestamps instead of being aligned to whole days.

#### Overviews and image assets

- Character overview cards and the sidebar now show element and profession icons, with recalibrated element colors and profession icons selected by the character's profession ID.
- Removed rarity-star labels from Character and Weapon overviews and danger-level labels from the Enemy overview. Filters, sorting, and detail data are unchanged.
- Rich-text inline icons, term-link icons, and link-tooltip icons now resolve through the active data origin, fixing missing `data.akedata.wiki` hosts and malformed `//public/...` paths.

### v1.2.6

#### Baker communications

- Added the Baker module for browsing complete Operator, contact, and group conversations, with type filters, full-text search, and URL deep links.
- Multiple conversations with the same contact now appear as separate sidebar entries, and dialogue choices can switch the following branch.
- Added text, picture, item and mission attachments, system messages, reactions, and image rendering for `sns_emoji` choices, with improved avatar, scrolling, desktop, and mobile layouts.

### v1.2.5

#### Image assets and uploads

- Image assets now keep their original directory structure under `assets/beyond/dynamicassets/gameplay`, and all modules request them from the new paths.
- Fixed missing assets caused by beyond-sdk directory matching and incomplete internal mappings, including exact separation of `charremoteicon` from similarly prefixed directories such as `charremoteicon700`.
- AKE Data Tool now supports uploading images, Json data, or both. It checks the entire R2 bucket's current and projected peak size before and after syncing, and blocks uploads at 10 GB.
- Module HTML and JavaScript use `pluginversion` and `jsversion` independently, so unchanged resources continue to use the local cache.
- Baker module development is not included in this release and has been postponed to `1.2.6`.

### v1.2.4

#### Shop module

- New Shop module (`v3_shop`) covering all in-game stores: regional exchanges, quota redemption, credit trading, cash shop, and Weapon Exchange.
- Weapon Exchange includes a "Weapon Rotation" page with current weekly/daily weapons, live countdown, next-batch preview, and a full rotation calendar table.
- Weapon claim products display gacha pool contents with weights; 6-star weapons are expanded by default.
- Discounts shown as `-xx%` (remaining percentage).

#### Other

- Added items in version comparison are always highlighted with a green "New" badge and pinned to top.
- Missing baseline tables now fall back gracefully to empty data for all modules.
- Internal IDs are hidden when "Show hidden modules" is off.

### v1.2.3

#### Modules and visibility

- The Missions module is temporarily hidden and marked “In development.” The BuffData, SkillData, and SpawnerConfig debug modules are now disabled, and the Echoes of War entry description has been updated.
- Character, equipment, activity, Buff, and other internal IDs are hidden unless “Show hidden modules” is enabled. Raw values and calculation formulas are now always available.
- Attribute modifiers are grouped by source, such as spawn, Buff, and stage bonuses. Attribute Buffs in the Enemy module now participate in calculations; when hidden mode is off, Buff IDs and Buffs without attribute effects are not shown.

#### Enemies and game modes

- Dungeons, Contingency Contract, and Echoes of War now share one enemy renderer for level stats, spawn Buffs, and modified results. All three use the new elemental resistance attributes (94–99), while legacy coefficients (80–85) are no longer shown.
- Echoes of War rotations can be expanded or collapsed and use border colors for active, upcoming, and ended states. Only active rotations open by default, with only the highest-difficulty enemy configuration expanded in each rotation.
- When all three difficulties of a stage share the same trait and trait-bonus descriptions, those descriptions appear once before the difficulty list. Different descriptions remain attached to their respective difficulties.
- Fixed `v2cc-term-param` rendering in Contingency Contract. Activity configuration is collapsed by default, and mission unlock conditions are hidden.

#### Activities and interface details

- The Activity landing page now includes a calendar timeline showing start dates, end dates, and status. It provides date tooltips, keeps off-screen titles at the visible left edge, and displays height-filling activity icons aligned to the right. Returning through the module Home button now rerenders the timeline correctly.
- Fixed escaped line breaks in character and weapon skill descriptions. Equipment crafting now shows the default component icon beside the crafting-cost button.
- Long-image export has left testing and is enabled by default. Exports from every module omit the sidebar and use the correct module or page filename.

#### Data loading and announcements

- Persistent TableCfg caches now change only with the Hotfix. Json and images use an independent shared-data revision and are no longer reloaded because the site version or Hotfix changed.
- Announcements now render Markdown headings, lists, inline code, and related syntax correctly. The About page and README also add the Endfield Yituliu data partner link.

### v1.2.2

Raw values and calculation formulas now open in a persistent popover when a value is clicked, replacing delayed hover tooltips. Clicking another value switches the content; clicking blank page space or pressing Esc closes it. The popover repositions on scrolling and resizing, supports mobile and keyboard interaction, and does not add new visual styling to the values themselves.

Fixed module-level parent click handlers preventing real mouse clicks from opening the popover. Also fixed skill raw values for `chr_0032_lizhiyan` appearing as `[object Object]`.

### v1.2.1

Fixed an issue where some game images could incorrectly be requested from `www.akedata.wiki` after switching modules or after the Service Worker was suspended and restarted. Image paths are now synchronously rewritten to `data.akedata.wiki` when inserted into the page, covering dynamic HTML, image attributes, `srcset`, posters, and inline backgrounds.

The Service Worker now restores the data origin and shared-data revision from its registration URL and completes configuration during application startup. Its image-routing state therefore survives browser termination and restart of the worker. The site icon is also loaded directly from the data origin.

Added `LevelScriptData` enemy parsing to stat calculations in Dungeons, Contingency Contract, and Echoes of War. The site now reads enemies, levels, and spawn Buffs defined directly in scripts, as well as conditional Buffs applied through spawners. Enemy stats are therefore calculated correctly even for stages without SpawnerConfig. Contingency Contract tag-Buff preloading and stat recalculation after tag changes were also fixed.

Improved raw-value tooltips. Values without a gameplay calculation change continue to show their original value, while values modified by stat modifiers, Buffs, contract tags, or expressions now show the source value, substituted parameters, complete calculation formula, and final result. Formula tracing covers Dungeon, Contingency Contract, Echoes of War, and Enemy stats, as well as calculated descriptions for characters, weapons, equipment, and items.

### v1.2.0

Added cross-version data comparison. When `Latest` is selected, the site automatically compares it with the final Hotfix of the previous game version. New entries are always prioritized and tagged; modified-entry tags and detail Diff can be enabled with the experimental global setting, which is off by default.

Detail Diff compares only information actually rendered on the page, showing removed content in red and added content in green while ignoring hidden fields. Activities are excluded from new-entry detection. Equipment and medals are compared by their individual IDs, with containing sets or categories tagged as well. New status is shown only by tags, so card outlines continue to follow rarity colors.

### v1.2.0-pre2

Updated the complete Attribute mapping, added IDs 93–100, and synchronized `maps.json` across all 14 languages.

Enemy and dungeon modules now use the new elemental resistance parameters (IDs 94–99). Legacy resistance scalar IDs 80–85 are no longer shown in related stat cards, modifier summaries, or Buff tooltips, preventing duplicate entries and incorrect values.

### v1.2.0-pre1

Separated game data from the website code. TableCfg, Json, and image assets are now stored in Cloudflare R2 and delivered through data.akedata.wiki and the EdgeOne CDN. Added a data manifest and version selector for switching between Latest and multiple game/Hotfix versions while preserving the selection. Only TableCfg is versioned; Json and images remain shared data.

Added a configurable data request origin and an R2 synchronization script. The script can derive the game and Hotfix versions from an official Hotfix URL or accept manual input, publish TableCfg/Json/images together, update shared data only, control whether a release becomes Latest, and run a dry-run before uploading. In debug mode, Latest uses local Live Server data while pinned versions continue to use production history.

Also isolated caches by data origin and version, and moved the image-proxy Service Worker to the site root to prevent stale data after version changes, reloads, or source switches. This is the first prerelease of AKEData 1.2.0.

### v1.1.9

Added the permanent challenge feature page “Echoes of War,” with season and rotation views for stages, difficulties, rating titles, merit rewards, and official instructions. It also displays enemy waves, spawn-position maps, spawn buffs, and level-adjusted attributes, with wave switching and linked map highlighting.

### v1.1.8

Added debug mode and forced web-cache refresh; fixed character attribute nodes and development-cost parsing based on item descriptions; switched activity types to ActivityTagTable; moved rich-text styles and terms directly to TableCfg; and added sidebar home buttons to modules with landing pages.

### v1.1.6

Added site announcements and an update countdown, adapted Arcane's dual-form skill sets, improved loading messages, and removed many deprecated v2 modules.

### v1.1.5

Launched the multilingual framework, enabling language switching for the UI, modules, filters, and data mappings, with the first multilingual resources included.

### v1.1.4

Fixed version parameters for data requests, separated refresh versions for app assets and public data, and unified page cache and service worker version checks.

### v1.1.3

Added consumable effects and crafting recipes to the item module, including material-output relationships, detail styles, and corresponding v3 data adapters.

### v1.1.2

Added grouped card overview entries for characters, weapons, enemies, equipment, activities, items, dungeons, achievements, research, and other modules.

### v1.1.1

Reworked item category filters with collapsing and result counts, while improving request deduplication, IndexedDB caching, and data loading progress displays.

### v1.1.0

Launched the v3 data adapter layer based on TableCfg and Json for major query modules, with module disabling and large data file caching.

### v1.0.31

Previously added Chinese-English UI and data directory switching with related internationalization settings, but fully rolled it back and did not retain it at this stage.

### v1.0.30

Added a unified request cache wrapper and switched pages to akeFetch, reducing duplicate requests and improving loading logic when changing modules.

### v1.0.29

Moved inline scripts from the home page and modules into plugin/js, centralizing routing, settings, stat calculations, and module controllers.

### v1.0.28

Added raw-value tooltips for most module parameters, and fixed enemy HP calculations and the display of All Damage Reduction.

### v1.0.27

Added enemy-wave visualization to Contingency Contract with spawn coordinates, wave switching, and linked highlighting, while correcting merged statistics for repeated waves.

### v1.0.26

Added enemy stat inspection to Contingency Contract, calculating and displaying actual stats from level, spawn Buffs, and selected contract tags.

### v1.0.25

Preloaded and opened the Token-restricted Contingency Contract module with season search, tag conditions, conflict checks, scoring, rewards, missions, and shop displays.

### v1.0.24

Updated character v2 skill displays, corrected the order of combo and ultimate skills, and retained key parameters such as cooldowns and energy costs.

### v1.0.23

Officially opened the research module, enhanced Markdown, code highlighting, indexes, anchor navigation, and image previews, and added mechanics research articles.

### v1.0.22

Added access restrictions for modules and content using access Tokens, with Token persistence, bulk addition and clearing, plus protected content preloading.

### v1.0.21

Added Physical Anomaly Damage and Arts Anomaly Damage coefficients to the character v2 stat growth table, with precision varying by display mode.

### v1.0.20

Reordered and renamed some detailed enemy stats, moved interruption resistance and execution entries earlier, and standardized damage bonus tag wording.

### v1.0.19

Added equipment ID display, reorganized character, weapon, and equipment v2 styles, and fixed stat colors and growth value selection.

### v1.0.18

Added deep links for modules and entries, synchronized the address bar during navigation, handled hidden or missing content, and improved character stat modifier type displays.

### v1.0.17

Officially launched weapon v2 with weapon search and detailed displays for level stats, ascension materials, potentials, and skills.

### v1.0.16

Officially launched equipment v2, showing parts, primary and secondary stats, set skills, crafting recipes, precision forging guarantees, and enhancement details by set.

### v1.0.15

Officially launched dungeon v2 with series, reward, and enemy details, parsing SpawnerConfig and Buffs to show waves and modified stats.

### v1.0.14

Officially launched enemy v2 with search, mobile lists, level stats, enemy variants, stat modifiers, resistances, and stagger information.

### v1.0.13

Officially launched character v2, rebuilding stats, skills, talents, potentials, and growth information while fixing traits, images, and node displays.

### v1.0.12

Enhanced the SkillData v2 timeline with action filters, conditional branch flowcharts, node visibility, and frame-duration tooltips, while fixing some enemy values.

### v1.0.11

Added a hidden SkillData v2 debug view that presents skill logic through timelines and action nodes, with search and raw data viewing.

### v1.0.10

Continued the character v2 rebuild by creating the new character detail view, integrating complete character data, and improving field mappings and display structure.

### v1.0.9

Added the SpawnerConfig query module for browsing spawner data by scene and configuration, and adjusted the BuffData and SkillData query entries.

### v1.0.8

Added BuffData and SkillData query modules with manifest browsing, search, and detail views, providing access for underlying combat data research.

### v1.0.7

Added activity information queries, adjusted default character tag displays with support for Rossi's special tags, and added site traffic statistics.

### v1.0.6

Added a sponsor list and related styles to the About page, improving the display of project acknowledgments.

### v1.0.5

Completed mobile adaptation for major modules including characters, weapons, enemies, equipment, items, dungeons, and achievements across all three themes.

### v1.0.4

Added filters to character, weapon, and item modules and rebuilt list filtering areas to improve searches across large numbers of entries.

### v1.0.3

Added the item query interface and registered the item module, supporting item lists, details, and related basic information.

### v1.0.2

Added skill icons and base skills to character pages, including facility types, skill levels, descriptions, and unlock conditions, while fixing related data.

### v1.0.1

Fixed abnormal displays of fixed enemy stat data and improved the corresponding enemy information on dungeon pages.

### v1.0.0

Officially launched AKEData 1.0, completing major dungeon query improvements and raising the project version from 0.99 to 1.0.
