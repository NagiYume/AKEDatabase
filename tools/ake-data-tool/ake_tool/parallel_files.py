"""Bounded parallel work for independent local files."""
from concurrent.futures import ThreadPoolExecutor
from itertools import islice


def map_files(function, items, workers=4):
    """Yield results in input order without queuing an entire large tree."""
    iterator = iter(items)
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ake-files") as pool:
        while batch := list(islice(iterator, workers * 8)):
            yield from pool.map(function, batch)
