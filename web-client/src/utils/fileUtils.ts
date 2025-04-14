import { useRecTreeStore } from '@/stores/recTreeStore';
import { db } from '@/db/SlideRuleDb';
import { ref } from 'vue';

const recTreeStore = useRecTreeStore();
const rows = ref<Array<Record<string, any>>>([]);
const columns = ref<string[]>([]);

type ExportFormat = 'parquet' | 'csv';

async function exportFile(format: ExportFormat): Promise<void> {
    const req_id = recTreeStore.selectedReqId;

    try {
        if (req_id <= 0) {
            console.error("Selected request ID is invalid");
            return;
        }

        if (format === 'parquet') {
            const fileName = await db.getFilename(req_id);
            const opfsRoot = await navigator.storage.getDirectory();
            const folderName = 'SlideRule';
            const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
            const fileHandle = await directoryHandle.getFileHandle(fileName, { create: false });
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const msg = `File ${fileName} exported successfully!`;
            console.log(msg);
            alert(msg);
        } else if (format === 'csv') {
            if (!rows.value || rows.value.length === 0) {
                alert("No rows available to export.");
                return;
            }

            let csvContent = columns.value.join(',') + '\n';
            rows.value.forEach(row => {
                const rowData = columns.value.map(col => {
                    const cellValue = row[col] == null ? '' : String(row[col]);
                    return `"${cellValue.replace(/"/g, '""')}"`;
                });
                csvContent += rowData.join(',') + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'export.csv';
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log("CSV exported successfully!");
        }
    } catch (error) {
        console.error(`Failed to export (req_id: ${req_id}, format: ${format})`, error);
        alert(`Failed to export file for req_id: ${req_id} as ${format.toUpperCase()}`);
    }
}
