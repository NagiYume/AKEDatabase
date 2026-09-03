import java.nio.file.Path;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;

import tech.perlica.ci.tasks.FetchLatestVersion;
import tech.perlica.endfield.il2cpphost.runtime.VfsKeyResolver;

public final class BeyondSdkVfsKeyRunner {
    private BeyondSdkVfsKeyRunner() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 4) {
            throw new IllegalArgumentException(
                "Usage: BeyondSdkVfsKeyRunner <vfs> <runtime-directory> <version> <package-path>"
            );
        }

        Path vfsRoot = Path.of(args[0]).toAbsolutePath().normalize();
        Path runtimeRoot = Path.of(args[1]).toAbsolutePath().normalize();
        FetchLatestVersion.LatestGameInfo gameInfo =
            new FetchLatestVersion.LatestGameInfo(args[2], args[3]);
        byte[] key = VfsKeyResolver.INSTANCE.resolveForProcessLifetime(
            vfsRoot,
            runtimeRoot,
            gameInfo
        );
        System.out.println("VFS_KEY_BASE64=" + Base64.getEncoder().encodeToString(key));
        System.out.flush();

        new CountDownLatch(1).await();
    }
}
