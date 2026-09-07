import java.nio.file.Files;
import java.nio.file.Path;

import tech.perlica.ci.TableCfgExtraction;
import tech.perlica.ci.TableCfgExtractionRequest;
import tech.perlica.ci.VFSTableCfgExtractor;

public final class BeyondSdkTableRunner {
    private BeyondSdkTableRunner() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException(
                "Usage: BeyondSdkTableRunner <vfs> <output>"
            );
        }

        Path vfsRoot = Path.of(args[0]).toAbsolutePath().normalize();
        Path outputRoot = Path.of(args[1]).toAbsolutePath().normalize();
        if (!Files.isDirectory(vfsRoot)) {
            throw new IllegalArgumentException(
                "TableCfg VFS input directory is missing: " + vfsRoot
            );
        }
        Files.createDirectories(outputRoot);

        Path rawRoot = outputRoot.resolve("raw");
        Path tableCfgRoot = outputRoot.resolve("data").resolve("TableCfg");
        TableCfgExtraction extraction = new VFSTableCfgExtractor().extract(
            new TableCfgExtractionRequest(vfsRoot, rawRoot, tableCfgRoot)
        );

        System.out.println(
            "TableCfg extracted: " + extraction.getFiles().size()
                + " JSON files from " + extraction.getRawExtractedFiles()
                + " VFS files"
        );
        System.out.println("TableCfg output: " + extraction.getOutputDirectory());
    }
}
