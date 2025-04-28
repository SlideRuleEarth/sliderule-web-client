export function canWriteToOPFS(): boolean {
    const w = window as any;
    return !!(w.navigator?.storage?.getDirectory && typeof w.FileSystemWritableFileStream !== 'undefined');
}
export async function writeToOPFSFile(directoryHandle: FileSystemDirectoryHandle, fileName: string, file: File): Promise<FileSystemFileHandle> {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return fileHandle;
}