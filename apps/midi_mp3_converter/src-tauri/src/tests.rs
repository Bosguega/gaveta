#[cfg(test)]
mod tests {
    use crate::midi::analyze;
    use crate::settings::{ExistingPolicy, Settings};
    use std::path::{Path, PathBuf};

    #[test]
    fn test_destination_same_folder() {
        let settings = Settings::default();
        let src = Path::new("C:/Musicas/track.mid");
        let parent = src.parent().unwrap();
        let stem = src.file_stem().unwrap();
        let dest = parent.join(format!("{}.mp3", stem.to_string_lossy()));
        assert_eq!(dest, PathBuf::from("C:/Musicas/track.mp3"));
        assert_eq!(settings.existing, ExistingPolicy::Overwrite);
    }

    #[test]
    fn test_destination_custom_folder() {
        let mut settings = Settings::default();
        settings.output_dir = Some("D:/Out".to_string());
        let src = Path::new("C:/Musicas/track.mid");
        let stem = src.file_stem().unwrap();
        let out_dir = PathBuf::from(settings.output_dir.as_ref().unwrap());
        let dest = out_dir.join(format!("{}.mp3", stem.to_string_lossy()));
        assert_eq!(dest, PathBuf::from("D:/Out/track.mp3"));
    }

    #[test]
    fn test_analyze_invalid_midi_fails() {
        let invalid = Path::new("C:/inexistente_xyz_123.mid");
        assert!(analyze(invalid).is_err());
    }
}