import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import kotlin.text.Regex;
import kotlin.text.RegexOption;
import tech.perlica.bundles.animestudio.cli.AnimeStudioCliKt;
import tech.perlica.bundles.animestudio.core.export.AssetEntry;
import tech.perlica.bundles.animestudio.core.export.AssetMap;
import tech.perlica.bundles.animestudio.core.export.AssetMapMessagePack;
import tech.perlica.ci.BundlesContainerSelection;
import tech.perlica.ci.BundlesExportLayout;
import tech.perlica.ci.BundlesExportProfile;
import tech.perlica.ci.VFSHelper;
import tech.perlica.ci.models.bundles.ManifestAssetMapBuildResult;
import tech.perlica.ci.models.bundles.ManifestAssetMapDiagnostic;

public final class BeyondSdkImageRunner {
    // beyond-sdk 当前把 unsigned 64-bit 内容 hash 序列化为无前导零十六进制文本。
    private static final Pattern VALID_HASH = Pattern.compile("^[0-9a-fA-F]{1,16}$");

    private BeyondSdkImageRunner() {}

    public static void main(String[] args) throws Exception {
        if (
            (args.length == 6 || args.length == 7)
            && "--test-diff".equals(args[0])
        ) {
            AssetMap fixture = AssetMapMessagePack.INSTANCE.decode(
                Files.readAllBytes(Path.of(args[1]))
            );
            List<AssetMap> fixtureHistories = new ArrayList<>();
            addHistoryMap(fixtureHistories, args[2]);
            int outputOffset = 3;
            if (args.length == 7) {
                addHistoryMap(fixtureHistories, args[3]);
                outputOffset = 4;
            }
            DiffResult fixtureDiff = createDeltaAndRemoteMaps(
                fixture,
                fixtureHistories,
                Path.of(args[outputOffset]),
                Path.of(args[outputOffset + 1]),
                Path.of(args[outputOffset + 2]).toAbsolutePath().normalize()
            );
            System.out.println(mapResultLine(fixture, fixtureDiff, 0, 0));
            return;
        }
        if (args.length != 7 && args.length != 9) {
            throw new IllegalArgumentException(
                "Usage: BeyondSdkImageRunner <vfs> <run-root> <delta-output> "
                    + "<containers-filter> <history-map-or-dash> <remote-map> <history-entry-count> "
                    + "[additional-history-map-or-dash additional-history-entry-count]"
            );
        }

        Path vfsRoot = Path.of(args[0]).toAbsolutePath().normalize();
        Path runRoot = Path.of(args[1]).toAbsolutePath().normalize();
        Path deltaOutput = Path.of(args[2]).toAbsolutePath().normalize();
        String containersFilter = args[3];
        Path remoteMap = Path.of(args[5]).toAbsolutePath().normalize();
        Files.createDirectories(runRoot);
        Files.createDirectories(deltaOutput);

        // 所有历史 map 必须先完成原生反序列化与条目数校验，失败时不得构建当前完整 map。
        List<AssetMap> historyAssetMaps = new ArrayList<>();
        addValidatedHistoryMap(historyAssetMaps, args[4], Integer.parseInt(args[6]));
        if (args.length == 9) {
            addValidatedHistoryMap(historyAssetMaps, args[7], Integer.parseInt(args[8]));
        }

        String encodedKey = System.getenv("PERLICA_VFS_KEY_BASE64");
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new IllegalArgumentException("PERLICA_VFS_KEY_BASE64 is required");
        }
        byte[] vfsKey = Base64.getDecoder().decode(encodedKey);
        if (vfsKey.length != 32) {
            throw new IllegalArgumentException("Expected a 32-byte VFS key");
        }

        VFSHelper helper = new VFSHelper(
            vfsRoot,
            vfsRoot.resolve("beyond-tools-unused"),
            runRoot,
            false,
            null,
            8,
            false,
            true
        );
        BundlesExportProfile profile = BundlesExportProfile.INSTANCE;
        BundlesContainerSelection selection = new BundlesContainerSelection(
            List.of(containersFilter),
            Map.of()
        );
        ManifestAssetMapBuildResult result =
            helper.buildAnimeStudioAssetMapFromVfs$beyond_sdk(
                vfsRoot,
                runRoot,
                profile.getMapTypeFilter(),
                List.of(new Regex(containersFilter, RegexOption.IGNORE_CASE)),
                vfsKey
            );
        for (ManifestAssetMapDiagnostic diagnostic : result.getDiagnostics()) {
            System.err.println(
                "[" + diagnostic.getSeverity() + "] "
                    + diagnostic.getStage() + ": "
                    + diagnostic.getAssetPath() + " - "
                    + diagnostic.getMessage()
            );
        }

        AssetMap currentMap = AssetMapMessagePack.INSTANCE.decode(
            Files.readAllBytes(runRoot.resolve("assets.map"))
        );
        if (currentMap.getAssetEntries().size() != result.getEntries().size()) {
            throw new IllegalStateException("SDK build result and native map entry counts differ");
        }
        Path fullMapPath = runRoot.resolve("assets.full.map");
        Files.write(fullMapPath, AssetMapMessagePack.INSTANCE.encode(currentMap));

        Path deltaMapPath = runRoot.resolve("assets.delta.map");
        DiffResult diff = createDeltaAndRemoteMaps(
            currentMap,
            historyAssetMaps,
            deltaMapPath,
            remoteMap,
            vfsRoot
        );

        if (!diff.deltaEntries.isEmpty()) {
            List<String> legacyArguments = profile.legacyArguments(
                vfsRoot,
                deltaOutput,
                deltaMapPath,
                selection,
                BundlesExportLayout.ByContainer
            );
            AnimeStudioCliKt.runLegacyAnimeStudioCli(
                legacyArguments.toArray(String[]::new)
            );
        }
        System.out.println(
            mapResultLine(
                currentMap,
                diff,
                result.getWarnings().size(),
                result.getFailures().size()
            )
        );
    }

    private static DiffResult createDeltaAndRemoteMaps(
        AssetMap currentMap,
        List<AssetMap> oldMaps,
        Path deltaMapPath,
        Path remoteMap,
        Path vfsRoot
    ) throws Exception {
        Set<String> oldHashes = new HashSet<>();
        int oldEntries = 0;
        for (AssetMap oldMap : oldMaps) {
            if (oldMap.getGameType() != currentMap.getGameType()) {
                throw new IllegalArgumentException("History map game type differs from current map");
            }
            oldEntries += oldMap.getAssetEntries().size();
            for (AssetEntry entry : oldMap.getAssetEntries()) {
                String hash = normalizedValidHash(entry.getHash());
                if (hash != null) {
                    oldHashes.add(hash);
                }
            }
        }
        List<AssetEntry> deltaEntries = new ArrayList<>();
        int skipped = 0;
        int invalidCurrentHashes = 0;
        for (AssetEntry entry : currentMap.getAssetEntries()) {
            String hash = normalizedValidHash(entry.getHash());
            if (hash == null) {
                invalidCurrentHashes++;
                deltaEntries.add(entry);
            } else if (oldHashes.contains(hash)) {
                skipped++;
            } else {
                deltaEntries.add(entry);
            }
        }
        Files.createDirectories(deltaMapPath.toAbsolutePath().normalize().getParent());
        Files.write(
            deltaMapPath,
            AssetMapMessagePack.INSTANCE.encode(
                new AssetMap(currentMap.getGameType(), deltaEntries)
            )
        );

        List<AssetEntry> remoteEntries = new ArrayList<>(currentMap.getAssetEntries().size());
        int normalizedSources = 0;
        for (AssetEntry entry : currentMap.getAssetEntries()) {
            String normalizedSource = normalizeRemoteSource(entry.getSource(), vfsRoot);
            if (!normalizedSource.equals(entry.getSource())) {
                normalizedSources++;
            }
            remoteEntries.add(
                new AssetEntry(
                    entry.getName(),
                    entry.getContainer(),
                    normalizedSource,
                    entry.getPathId(),
                    entry.getType(),
                    entry.getHash(),
                    entry.getOffset()
                )
            );
        }
        Files.createDirectories(remoteMap.toAbsolutePath().normalize().getParent());
        Files.write(
            remoteMap,
            AssetMapMessagePack.INSTANCE.encode(
                new AssetMap(currentMap.getGameType(), remoteEntries)
            )
        );
        return new DiffResult(
            deltaEntries,
            oldEntries,
            oldHashes.size(),
            skipped,
            invalidCurrentHashes,
            normalizedSources
        );
    }

    private static void addHistoryMap(List<AssetMap> histories, String value) throws Exception {
        if (!"-".equals(value)) {
            histories.add(
                AssetMapMessagePack.INSTANCE.decode(Files.readAllBytes(Path.of(value)))
            );
        }
    }

    private static void addValidatedHistoryMap(
        List<AssetMap> histories,
        String value,
        int expectedEntries
    ) throws Exception {
        if ("-".equals(value)) {
            if (expectedEntries != 0) {
                throw new IllegalArgumentException(
                    "Missing history map has a non-zero manifest entry count"
                );
            }
            return;
        }
        AssetMap history = AssetMapMessagePack.INSTANCE.decode(
            Files.readAllBytes(Path.of(value).toAbsolutePath().normalize())
        );
        if (history.getAssetEntries().size() != expectedEntries) {
            throw new IllegalArgumentException(
                "History map entry count differs from manifest: "
                    + history.getAssetEntries().size() + " != " + expectedEntries
            );
        }
        histories.add(history);
    }

    private static String mapResultLine(
        AssetMap currentMap,
        DiffResult diff,
        int warnings,
        int failures
    ) {
        return "AKE_MAP_RESULT"
            + "|full=" + currentMap.getAssetEntries().size()
            + "|old=" + diff.oldEntries
            + "|oldHashes=" + diff.oldHashes
            + "|delta=" + diff.deltaEntries.size()
            + "|skipped=" + diff.skipped
            + "|invalidCurrent=" + diff.invalidCurrentHashes
            + "|normalizedSources=" + diff.normalizedSources
            + "|warnings=" + warnings
            + "|failures=" + failures;
    }

    private static final class DiffResult {
        private final List<AssetEntry> deltaEntries;
        private final int oldEntries;
        private final int oldHashes;
        private final int skipped;
        private final int invalidCurrentHashes;
        private final int normalizedSources;

        private DiffResult(
            List<AssetEntry> deltaEntries,
            int oldEntries,
            int oldHashes,
            int skipped,
            int invalidCurrentHashes,
            int normalizedSources
        ) {
            this.deltaEntries = deltaEntries;
            this.oldEntries = oldEntries;
            this.oldHashes = oldHashes;
            this.skipped = skipped;
            this.invalidCurrentHashes = invalidCurrentHashes;
            this.normalizedSources = normalizedSources;
        }
    }

    private static String normalizedValidHash(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return VALID_HASH.matcher(normalized).matches() ? normalized : null;
    }

    private static String normalizeRemoteSource(String source, Path vfsRoot) {
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException("AssetEntry.source is empty");
        }
        String normalized = source.trim().replace('\\', '/');
        String vfs = vfsRoot.toString().replace('\\', '/');
        if (normalized.regionMatches(true, 0, vfs, 0, vfs.length())
            && normalized.length() > vfs.length()
            && normalized.charAt(vfs.length()) == '/') {
            normalized = normalized.substring(vfs.length() + 1);
        }
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("/") || normalized.matches("^[A-Za-z]:.*")) {
            throw new IllegalArgumentException("AssetEntry.source is outside current VFS: " + source);
        }
        List<String> parts = new ArrayList<>();
        for (String part : normalized.split("/")) {
            if (part.isEmpty() || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                throw new IllegalArgumentException("AssetEntry.source contains '..': " + source);
            }
            parts.add(part);
        }
        if (parts.isEmpty()) {
            throw new IllegalArgumentException("AssetEntry.source normalizes to empty: " + source);
        }
        return String.join("/", parts);
    }
}
