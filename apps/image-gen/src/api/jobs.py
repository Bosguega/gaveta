"""Simple in-memory job queue.

Generations are CPU/GPU bound and slow, so requests go through a single
worker thread. The HTTP request blocks until the job finishes (sufficient
for the MVP), but the job structure keeps the door open for async polling
later.
"""

import queue
import threading
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Job:
    id: str
    fn: Callable[[], Any]
    status: str = "queued"  # queued | running | completed | failed
    result: Any = None
    error: str | None = None
    done: threading.Event = field(default_factory=threading.Event)


class JobQueue:
    def __init__(self) -> None:
        self._queue: queue.Queue[Job] = queue.Queue()
        self._worker: threading.Thread | None = None

    def _run(self) -> None:
        while True:
            job = self._queue.get()
            job.status = "running"
            try:
                job.result = job.fn()
                job.status = "completed"
            except Exception:  # noqa: BLE001
                job.status = "failed"
                job.error = traceback.format_exc()
            job.done.set()

    def start(self) -> None:
        if self._worker is None:
            self._worker = threading.Thread(target=self._run, daemon=True, name="job-worker")
            self._worker.start()

    def submit(self, fn: Callable[[], Any]) -> Job:
        job = Job(id=uuid.uuid4().hex, fn=fn)
        self._queue.put(job)
        return job

    def wait(self, job: Job) -> Job:
        job.done.wait()
        return job


job_queue = JobQueue()
