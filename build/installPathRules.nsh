; Rules for the two folders the install wizard asks for. Kept apart from installer.nsh (and free of
; anything from electron-builder) so that scripts/check-installer-rules.mjs can compile and run them
; on their own.
;
; The program folder is emptied as a whole on every upgrade and on uninstall, so it has to be a folder
; of its own. The data folder must therefore not live inside it, or an ordinary upgrade would delete
; the diary.
;
; Input : $INSTDIR (program folder as typed), $StateDataDir (data folder as typed or chosen)
; Output: $INSTDIR normalised (no trailing backslash, ending in \Tessera)
;         $PathsError  "" when fine, "root" (no usable program folder), "datainside"

Var PathsError

; WriteDataPathFile: Push the file's path, Push the data folder, Call. Writes datapath.txt as UTF-16 LE
; with a byte order mark: NSIS's plain FileWrite would store a folder such as D:\日记 in the ANSI code
; page, which the app (UTF-8) reads back as garbage. The app and the uninstaller read this form.
Function WriteDataPathFile
  Exch $1
  Exch
  Exch $0
  Push $2
  ClearErrors
  FileOpen $2 $0 w
  IfErrors write_done
  FileWriteWord $2 65279
  FileWriteUTF16LE $2 $1
  FileClose $2
  write_done:
  Pop $2
  Pop $0
  Pop $1
FunctionEnd

Function CheckInstallPaths
  Push $0
  Push $1
  Push $2
  StrCpy $PathsError ""

  ; Trailing backslashes ("D:\Apps\").
  trim_program:
    StrCpy $0 $INSTDIR 1 -1
    StrCmp $0 "\" 0 trimmed_program
    StrCpy $INSTDIR $INSTDIR -1
    Goto trim_program
  trimmed_program:

  ; Nothing, or a drive root ("D:" once the backslash is gone).
  StrLen $0 $INSTDIR
  IntCmp $0 3 root_error root_error program_checked
  root_error:
    StrCpy $PathsError "root"
    Goto done
  program_checked:

  ; A folder named Tessera, appended when the chosen one is not (electron-builder does the same on
  ; its own directory page, which this installer does not show).
  StrCpy $0 $INSTDIR 8 -8
  StrCmp $0 "\Tessera" program_named 0
  StrCpy $INSTDIR "$INSTDIR\Tessera"
  program_named:

  ; The data folder, likewise without trailing backslashes.
  StrCpy $1 $StateDataDir
  trim_data:
    StrCpy $0 $1 1 -1
    StrCmp $0 "\" 0 trimmed_data
    StrCpy $1 $1 -1
    Goto trim_data
  trimmed_data:
  StrCmp $1 "" done 0

  ; Inside the program folder (or the program folder itself)? Compare the leading part, then make
  ; sure the next character ends the name ("...\Tessera2" is a different folder).
  StrLen $0 $INSTDIR
  StrCpy $2 $1 $0
  StrCmp $2 $INSTDIR 0 done
  StrCpy $2 $1 1 $0
  StrCmp $2 "" data_inside 0
  StrCmp $2 "\" data_inside done
  data_inside:
    StrCpy $PathsError "datainside"

  done:
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
