; How the uninstaller reads the data folder recorded in datapath.txt. Kept apart from installer.nsh (and
; free of anything from electron-builder) so that scripts/check-installer-rules.mjs can compile and
; run it on its own. A macro, because a function used by the uninstaller must be named un.*, while the
; check program uses the plain name.
;
; Input : $UnDataDir      the first line of datapath.txt (may be empty, may end in a line break,
;                         spaces or a backslash)
;         $UnDefaultDir   the folder MotoTrace creates for itself, dedicated to it
; Output: $UnDataDir      cleaned up; $UnDefaultDir when the file named nothing
;         $UnDataKind     "default" (that dedicated folder) or "custom" (a folder the user chose,
;                         which may hold other files: the uninstaller never empties it)

!macro DataPathRules P
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
