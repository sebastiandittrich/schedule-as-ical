interface Deno {
    FsFile: Deno.File
}

declare namespace Deno {
    export const FsFile: typeof Deno.File
}
