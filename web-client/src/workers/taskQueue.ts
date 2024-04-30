export type WorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'server_msg';

export interface WorkerError {
    type: string;
    code: string;
    message: string;
}

export interface WorkerMessage {
    req_id: number;             // Request ID
    status: WorkerStatus;       // Status of the worker
    progress?: number;          // Percentage for progress updates
    msg?: string;               // status details
    error?: WorkerError;        // Error details (if an error occurred)
}

type Task = {
    data: any;  // Any data that isn't transferable
    buffer?: ArrayBuffer;  // An optional transferable buffer
    callback?: (message: any) => void;  // Optional callback function for task completion
    error_callback?: (message: any) => void;  // Optional callback function for task completion
};

export class TaskQueue {
    private workerPool: Worker[];
    private taskQueue: Task[];
    private activeWorkers: number;
    private concurrency: number;

    constructor(workerUrl: string, concurrency: number = 1) {
        const theWorkerUrl = new URL(workerUrl, import.meta.url);
        console.log('TaskQueue workerUrl:',theWorkerUrl, ' concurrency:',concurrency);
        this.workerPool = Array.from({ length: concurrency }, () => new Worker(theWorkerUrl, { type: 'module' }));
        this.taskQueue = [];
        this.activeWorkers = 0;
        this.concurrency = concurrency;
    }

    addTask(task: Task): number {
        this.taskQueue.push(task);
        this.processNextTask();
        return this.taskQueue.length;
    }

    getLength(): number {
        return this.taskQueue.length;
    }

    private processNextTask(): void {
        if (this.taskQueue.length > 0 && this.activeWorkers < this.concurrency) {
            const task = this.taskQueue.shift()!;
            const worker = this.workerPool[this.activeWorkers++];
            //worker.postMessage({ data: task.data }, [task.buffer]);
            worker.postMessage(JSON.stringify({ data: task.data }));
            worker.onmessage = (event) => {
                const workerMsg:WorkerMessage = event.data;
                console.log('Worker message:', workerMsg);
                this.activeWorkers--;
                if (task.callback) task.callback(event.data);  // Invoke the task-specific callback
                if(workerMsg.status === 'success' || workerMsg.status === 'error'){
                    this.processNextTask();
                }
            };
            worker.onerror = (e) => {
                console.error('Worker error:', e);
                this.activeWorkers--;
                if (task.error_callback) task.error_callback(e);  // Invoke the task-specific error callback
                this.processNextTask();
            };
        }
    }
}

// Example usage
// const buffer = new ArrayBuffer(1024); // Example buffer
// const queue = new TaskQueue('path/to/your/worker.js', 2);
// queue.addTask({ data: 'Task 1', buffer: buffer });
// queue.addTask({ data: 'Task 2', buffer: buffer });
