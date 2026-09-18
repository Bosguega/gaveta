//! Scan reconciliation.
//!
//! Turns the raw filesystem discovery result ([`crate::scanner::ScannedItem`])
//! plus a snapshot of the current index ([`crate::db::IndexedItem`]) into the
//! set of changes the scan has to apply. Keeping this pure means the
//! NEW / MODIFIED / UNCHANGED / MISSING rules are testable without a database or
//! a real filesystem.

use crate::db::IndexedItem;
use crate::scanner::ScannedItem;
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// How a discovered file relates to the current index.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    /// The file is not in the index yet.
    New,
    /// The file is indexed but its size or modified time changed.
    Modified,
    /// The file is indexed with identical metadata.
    Unchanged,
}

/// Outcome of comparing a discovery run against the index.
#[derive(Debug, Default)]
pub struct Reconciliation {
    /// One entry per discovered file, in the same order as the input.
    pub changes: Vec<ChangeKind>,
    /// Indexed items that are gone from disk and are not protected.
    pub missing_ids: Vec<i64>,
}

impl Reconciliation {
    /// Number of discovered files classified as `kind`.
    pub fn count(&self, kind: ChangeKind) -> usize {
        self.changes.iter().filter(|entry| **entry == kind).count()
    }
}

/// Compares discovered files with the index.
///
/// `protected_paths` holds roots that could not be read during this run (missing
/// folders and directories that raised an access error). Items living under them
/// are never reported as missing, so a transient failure cannot wipe healthy
/// records or their favorites.
///
/// When a collection configures nested roots the same file can be discovered
/// more than once; the first occurrence decides and the repeats are reported as
/// unchanged so nothing is inserted or counted twice.
pub fn reconcile(
    scanned: &[ScannedItem],
    indexed: &[IndexedItem],
    protected_paths: &[String],
) -> Reconciliation {
    let by_path: HashMap<&str, &IndexedItem> = indexed
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();

    let mut seen: HashSet<&str> = HashSet::with_capacity(scanned.len());
    let mut changes = Vec::with_capacity(scanned.len());

    for item in scanned {
        if !seen.insert(item.path.as_str()) {
            changes.push(ChangeKind::Unchanged);
            continue;
        }

        changes.push(match by_path.get(item.path.as_str()) {
            None => ChangeKind::New,
            Some(existing)
                if existing.size != item.size || existing.modified_at != item.modified_at =>
            {
                ChangeKind::Modified
            }
            Some(_) => ChangeKind::Unchanged,
        });
    }

    let missing_ids = indexed
        .iter()
        .filter(|entry| !seen.contains(entry.path.as_str()))
        .filter(|entry| !is_protected(&entry.path, protected_paths))
        .map(|entry| entry.id)
        .collect();

    Reconciliation {
        changes,
        missing_ids,
    }
}

/// True when `path` lives under one of the protected roots.
fn is_protected(path: &str, protected_paths: &[String]) -> bool {
    let path = Path::new(path);
    protected_paths
        .iter()
        .any(|root| path.starts_with(Path::new(root)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn discovered(path: &str, size: i64, modified_at: &str) -> ScannedItem {
        ScannedItem {
            path: path.to_string(),
            filename: "file.pdf".to_string(),
            size,
            modified_at: modified_at.to_string(),
            file_type: "pdf".to_string(),
        }
    }

    fn indexed(id: i64, path: &str, size: i64, modified_at: &str) -> IndexedItem {
        IndexedItem {
            id,
            path: path.to_string(),
            size,
            modified_at: modified_at.to_string(),
            thumbnail_key: None,
            thumbnail_status: "ready".to_string(),
        }
    }

    #[test]
    fn classifies_new_modified_and_unchanged() {
        let scanned = vec![
            discovered("/a/new.pdf", 1, "1"),
            discovered("/a/size.pdf", 2, "1"),
            discovered("/a/time.pdf", 3, "1"),
            discovered("/a/same.pdf", 4, "4"),
        ];
        let index = vec![
            indexed(10, "/a/size.pdf", 999, "1"),
            indexed(11, "/a/time.pdf", 3, "999"),
            indexed(12, "/a/same.pdf", 4, "4"),
        ];

        let result = reconcile(&scanned, &index, &[]);

        assert_eq!(
            result.changes,
            vec![
                ChangeKind::New,
                ChangeKind::Modified,
                ChangeKind::Modified,
                ChangeKind::Unchanged,
            ]
        );
        assert_eq!(result.count(ChangeKind::New), 1);
        assert_eq!(result.count(ChangeKind::Modified), 2);
        assert_eq!(result.count(ChangeKind::Unchanged), 1);
        assert!(result.missing_ids.is_empty());
    }

    #[test]
    fn reports_indexed_items_that_disappeared() {
        let index = vec![
            indexed(1, "/a/gone.pdf", 1, "1"),
            indexed(2, "/a/x.pdf", 1, "1"),
        ];
        let result = reconcile(&[], &index, &[]);
        assert_eq!(result.missing_ids, vec![1, 2]);
    }

    #[test]
    fn keeps_items_under_protected_roots() {
        let index = vec![
            indexed(1, "/offline/gone.pdf", 1, "1"),
            indexed(2, "/a/gone.pdf", 1, "1"),
        ];
        let result = reconcile(&[], &index, &["/offline".to_string()]);
        assert_eq!(result.missing_ids, vec![2]);
    }

    #[test]
    fn protected_root_matches_whole_path_segments_only() {
        let index = vec![indexed(1, "/offline-other/gone.pdf", 1, "1")];
        let result = reconcile(&[], &index, &["/offline".to_string()]);
        assert_eq!(result.missing_ids, vec![1]);
    }

    #[test]
    fn duplicates_of_an_indexed_file_stay_unchanged() {
        let scanned = vec![discovered("/a/x.pdf", 1, "1"), discovered("/a/x.pdf", 1, "1")];
        let index = vec![indexed(7, "/a/x.pdf", 1, "1")];

        let result = reconcile(&scanned, &index, &[]);

        assert_eq!(
            result.changes,
            vec![ChangeKind::Unchanged, ChangeKind::Unchanged]
        );
        assert!(result.missing_ids.is_empty());
    }

    #[test]
    fn duplicates_of_a_new_file_are_inserted_once() {
        let scanned = vec![discovered("/a/x.pdf", 1, "1"), discovered("/a/x.pdf", 1, "1")];
        let result = reconcile(&scanned, &[], &[]);
        assert_eq!(result.changes, vec![ChangeKind::New, ChangeKind::Unchanged]);
    }

    #[test]
    fn renamed_file_is_new_and_the_old_path_missing() {
        let scanned = vec![discovered("/a/renamed.pdf", 1, "1")];
        let index = vec![indexed(3, "/a/original.pdf", 1, "1")];

        let result = reconcile(&scanned, &index, &[]);

        assert_eq!(result.changes, vec![ChangeKind::New]);
        assert_eq!(result.missing_ids, vec![3]);
    }
}