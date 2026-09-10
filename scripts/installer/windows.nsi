Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
Name "WebAgentMate Connector"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\WebAgentMate"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Install WebAgentMate Connector for your Windows account.$\r$\n$\r$\nThe runtime is included. Chrome starts Connector when needed. Return to the extension and click Check again after installation."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PAYLOAD}\LICENSE"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
Var PayloadDir

Section "Connector"
  SetShellVarContext current
  CreateDirectory "$INSTDIR\versions"
  GetTempFileName $PayloadDir "$INSTDIR\versions"
  Delete "$PayloadDir"
  CreateDirectory "$PayloadDir"
  SetOutPath "$PayloadDir"
  ClearErrors
  File /r "${PAYLOAD}\*"
  ${If} ${Errors}
    RMDir /r "$PayloadDir"
    Abort "Could not copy Connector. Close Chrome and try again."
  ${EndIf}
  nsExec::ExecToStack '"$PayloadDir\runtime\node\node.exe" "$PayloadDir\setup.cjs" register "$PayloadDir"'
  Pop $0
  Pop $1
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP "Could not register Connector: $1"
    Abort
  ${EndIf}
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "DisplayName" "WebAgentMate Connector"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "PayloadPath" "$PayloadDir"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "NoRepair" 1
SectionEnd

Section "Uninstall"
  ReadRegStr $PayloadDir HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge" "PayloadPath"
  nsExec::ExecToStack '"$PayloadDir\runtime\node\node.exe" "$PayloadDir\setup.cjs" uninstall'
  Pop $0
  Pop $1
  ${If} $0 != "0"
    MessageBox MB_ICONSTOP "Close Chrome and retry uninstalling Connector. $1"
    Abort
  ${EndIf}
  RMDir /r "$INSTDIR\versions"
  Delete "$INSTDIR\Uninstall.exe"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WebAgentMateBridge"
  RMDir "$INSTDIR"
SectionEnd
