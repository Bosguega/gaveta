use std::fmt;

/// Identifies the kind of content a collection item represents.
/// This enum lives in its own module so the database layer only persists
/// the string representation while the application logic can dispatch
/// on the strongly-typed variant.
///
/// Each variant maps to a stable string stored in the `files.file_type` column.
/// New variants can be added here as rendering support for additional formats
/// is implemented, without touching the database schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileType {
    Pdf,
    Embroidery,
    Image,
    Unknown,
}

impl FileType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileType::Pdf => "pdf",
            FileType::Embroidery => "embroidery",
            FileType::Image => "image",
            FileType::Unknown => "unknown",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pdf" => FileType::Pdf,
            "embroidery" => FileType::Embroidery,
            "image" => FileType::Image,
            _ => FileType::Unknown,
        }
    }

    /// Detects file type from a file extension (case-insensitive).
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_ascii_lowercase().as_str() {
            "pdf" => FileType::Pdf,
            "pes" | "pec" | "jef" | "xxx" | "dst" | "exp" | "vip" | "vp3" | "hus" | "sew" => {
                FileType::Embroidery
            }
            "png" | "jpg" | "jpeg" | "bmp" | "gif" | "webp" => FileType::Image,
            _ => FileType::Unknown,
        }
    }

    /// Returns the extensions this file type handler supports.
    pub fn supported_extensions(&self) -> &'static [&'static str] {
        match self {
            FileType::Pdf => &["pdf"],
            FileType::Embroidery => &[
                "dst", "exp", "pes", "pec", "jef", "vp3", "xxx", "vip", "hus", "sew",
            ],
            FileType::Image => &["png", "jpg", "jpeg", "bmp", "gif", "webp"],
            FileType::Unknown => &[],
        }
    }

    /// Flat list of extensions the scanner should discover. Only formats that
    /// have a working renderer/processor are enabled.
    pub fn enabled_extensions() -> Vec<&'static str> {
        let mut exts = FileType::Pdf.supported_extensions().to_vec();
        exts.extend_from_slice(FileType::Image.supported_extensions());
        exts.extend_from_slice(FileType::Embroidery.supported_extensions());
        exts
    }
}

impl fmt::Display for FileType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
