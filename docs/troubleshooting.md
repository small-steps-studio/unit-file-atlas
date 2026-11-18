# Troubleshooting

## The report says the file is not valid

A unit file is made of sections such as [Unit] and [Service] with Key=Value lines. A file without any section is reported as "The file contains no unit sections." Lines ending in a backslash continue on the next line, and lines starting with # or ; are comments, exactly as systemd reads them. A drop-in file (*.conf in a .d folder) is recognised by its file name: each report starts with a note, shows only the settings in that file and skips the checks that need the whole unit.

## The file is too large

Reports read files up to the size set in `unitFileAtlas.maxFileSizeMB` (50 MB by default and at most). VS Code passes files only up to 50 MB to extensions, so a larger file cannot be read by any extension: split it, or save a shorter one.

## The preview does not open

The report always opens as a Markdown document. If the preview stays closed, set `unitFileAtlas.openReportsAsPreview` to true and check that the built-in Markdown extension is enabled.

## Pro or the trial does not unlock

Run **Unit File Atlas: Show Licence Status**. It tells whether a key is stored, whether it was checked, and how many trial days are left. Details are in [licence.md](licence.md).

## Something else

Run **Unit File Atlas: Report A Problem**. It copies a diagnostics block (versions, settings, licence state; no file contents) and opens the issues page.
