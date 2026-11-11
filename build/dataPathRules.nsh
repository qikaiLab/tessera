; How the uninstaller reads the data folder recorded in datapath.txt. Kept apart from installer.nsh (and
; free of anything from electron-builder) so that scripts/check-installer-rules.mjs can compile and
; run it on its own. A macro, because a function used by the uninstaller must be named un.*, while the
; check program uses the plain name.
;
; Input : $UnDataDir      the first line of datapath.txt (may be empty, may end in a line break,
;                         spaces or a backslash)
;         $UnDefaultDir   the folder Tessera creates for itself, dedicated to it
; Output: $UnDataDir      cleaned up; $UnDefaultDir when the file named nothing
;         $UnDataKind     "default" (that dedicated folder) or "custom" (a folder the user chose,
;                         which may hold other files: the uninstaller never empties it)

; ${P}ReadDataPathFile: Push the file's path, Call, Pop the first line of it ("" when it cannot be
; read). The app writes the file as UTF-8 for a path of ASCII characters (the same bytes as ANSI) and
; as UTF-16 LE with a byte order mark otherwise, so a folder like D:\日记 survives; the installer
; always writes the second form. A file without the mark is read as ANSI, as before.

!macro DataPathRules P
  Function ${P}ReadDataPathFile
    Exch $0
    Push $1
    Push $2
    StrCpy $2 ""
    ClearErrors
    FileOpen $1 $0 r
    IfErrors read_done
    ClearErrors
    FileReadWord $1 $0
    IfErrors read_ansi
    StrCmp $0 65279 read_utf16 read_ansi
    read_utf16:
      ClearErrors
      FileReadUTF16LE $1 $2
      Goto read_close
    read_ansi:
      FileSeek $1 0 SET
      ClearErrors
      FileRead $1 $2
    read_close:
      FileClose $1
    read_done:
    StrCpy $0 $2
    Pop $2
    Pop $1
    Exch $0
  FunctionEnd

  Function ${P}ClassifyDataDir
    Push $1

    trim_end:
      StrCpy $1 $UnDataDir 1 -1
      StrCmp $1 "$\r" strip_end
      StrCmp $1 "$\n" strip_end
      StrCmp $1 " " strip_end
      StrCmp $1 "\" strip_end trimmed_end
    strip_end:
      StrCpy $UnDataDir $UnDataDir -1
      Goto trim_end
    trimmed_end:

    StrCpy $UnDataKind "custom"
    StrCmp $UnDataDir "" use_default 0
    StrCmp $UnDataDir $UnDefaultDir use_default done
    use_default:
      StrCpy $UnDataDir $UnDefaultDir
      StrCpy $UnDataKind "default"

    done:
    Pop $1
  FunctionEnd
!macroend
