#!/usr/bin/env python3
"""Generate Vaalbara.xcodeproj from repository layout (no XcodeGen required)."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Vaalbara.xcodeproj"
PROJECT_NAME = "Vaalbara"


def uid(name: str) -> str:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"vaalbara.xcodeproj:{name}").hex[:24].upper()


def collect_app_swift_files() -> list[Path]:
    base = ROOT / "Vaalbara"
    files = sorted(base.rglob("*.swift"))
    return [f for f in files if "Package.swift" not in f.name]


def collect_resource_files() -> list[Path]:
    resources: list[Path] = []
    assets = ROOT / "Vaalbara" / "Assets.xcassets"
    if assets.exists():
        resources.append(assets)
    web_app = ROOT / "Vaalbara" / "Resources" / "WebApp"
    if web_app.exists():
        # Keep the production web bundle as a folder so relative asset URLs
        # continue to work inside WKWebView.
        resources.append(web_app)
    privacy_manifest = ROOT / "Vaalbara" / "PrivacyInfo.xcprivacy"
    if privacy_manifest.exists():
        resources.append(privacy_manifest)
    # Folder reference, same as WebApp: keeps anim/arena paths intact and
    # avoids flattening every .webp into the app root (which collides with
    # anything else that happens to share a basename).
    art = ROOT / "Vaalbara" / "Resources" / "Art"
    if art.exists():
        resources.append(art)
    return resources


def pbx_file_ref(path: Path, id_name: str) -> tuple[str, str]:
    ref_id = uid(f"fileref:{path}")
    rel = path.relative_to(ROOT).as_posix()
    if path.is_dir() and not path.name.endswith(".xcassets"):
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = folder; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    elif path.suffix == ".swift":
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    elif path.suffix == ".plist":
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    elif path.suffix == ".xcprivacy":
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = text.xml; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    elif path.suffix == ".entitlements":
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    elif path.name.endswith(".xcassets"):
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    else:
        line = f'\t\t{ref_id} /* {path.name} */ = {{isa = PBXFileReference; lastKnownFileType = file; path = "{rel}"; sourceTree = SOURCE_ROOT; }};'
    return ref_id, line


def main() -> None:
    swift_files = collect_app_swift_files()
    resource_files = collect_resource_files()

    project_id = uid("project")
    target_id = uid("target")
    sources_phase = uid("sources-phase")
    resources_phase = uid("resources-phase")
    frameworks_phase = uid("frameworks-phase")
    main_group = uid("main-group")
    products_group = uid("products-group")
    vaalbara_group = uid("vaalbara-group")
    product_ref = uid("product-ref")
    project_config_list = uid("project-config-list")
    target_config_list = uid("target-config-list")
    debug_config = uid("debug-config")
    release_config = uid("release-config")
    target_debug = uid("target-debug")
    target_release = uid("target-release")

    packages = [
        ("VaalbaraCore", "Packages/VaalbaraCore"),
        ("VaalbaraEngine", "Packages/VaalbaraEngine"),
        ("VaalbaraAudio", "Packages/VaalbaraAudio"),
        ("VaalbaraNetworking", "Packages/VaalbaraNetworking"),
    ]

    file_refs: list[str] = []
    build_files_sources: list[str] = []
    build_files_resources: list[str] = []
    swift_ref_ids: list[str] = []
    resource_ref_ids: list[str] = []

    for sf in swift_files:
        ref_id, line = pbx_file_ref(sf, sf.as_posix())
        file_refs.append(line)
        bf = uid(f"build:{sf}")
        build_files_sources.append(
            f"\t\t{bf} /* {sf.name} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref_id} /* {sf.name} */; }};"
        )
        swift_ref_ids.append(ref_id)

    for rf in resource_files:
        ref_id, line = pbx_file_ref(rf, rf.as_posix())
        file_refs.append(line)
        bf = uid(f"build:{rf}")
        build_files_resources.append(
            f"\t\t{bf} /* {rf.name} in Resources */ = {{isa = PBXBuildFile; fileRef = {ref_id} /* {rf.name} */; }};"
        )
        resource_ref_ids.append(ref_id)

    info_plist_ref = uid("info-plist")
    entitlements_ref = uid("entitlements")
    file_refs.append(
        f'\t\t{info_plist_ref} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Vaalbara/Info.plist; sourceTree = SOURCE_ROOT; }};'
    )
    file_refs.append(
        f'\t\t{entitlements_ref} /* Vaalbara.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Vaalbara/Vaalbara.entitlements; sourceTree = SOURCE_ROOT; }};'
    )

    package_refs: list[str] = []
    package_deps: list[str] = []
    target_package_deps: list[str] = []
    framework_build_files: list[str] = []
    framework_phase_files: list[str] = []
    for pkg_name, pkg_path in packages:
        pref = uid(f"pkgref:{pkg_name}")
        pdep = uid(f"pkgdep:{pkg_name}")
        pbuild = uid(f"pkgbuild:{pkg_name}")
        package_refs.append(
            f'\t\t{pref} /* XCLocalSwiftPackageReference "{pkg_name}" */ = {{\n'
            f'\t\t\tisa = XCLocalSwiftPackageReference;\n'
            f'\t\t\trelativePath = {pkg_path};\n'
            f'\t\t}};'
        )
        package_deps.append(
            f'\t\t{pdep} /* {pkg_name} */ = {{\n'
            f'\t\t\tisa = XCSwiftPackageProductDependency;\n'
            f'\t\t\tpackage = {pref} /* XCLocalSwiftPackageReference "{pkg_name}" */;\n'
            f'\t\t\tproductName = {pkg_name};\n'
            f'\t\t}};'
        )
        target_package_deps.append(f"\t\t\t\t{pdep} /* {pkg_name} */,")
        framework_build_files.append(
            f"\t\t{pbuild} /* {pkg_name} in Frameworks */ = {{isa = PBXBuildFile; productRef = {pdep} /* {pkg_name} */; }};"
        )
        framework_phase_files.append(f"\t\t\t\t{pbuild} /* {pkg_name} in Frameworks */,")

    sources_list = "\n".join(f"\t\t\t\t{uid(f'build:{sf}')} /* {sf.name} in Sources */," for sf in swift_files)
    resources_list = "\n".join(f"\t\t\t\t{uid(f'build:{rf}')} /* {rf.name} in Resources */," for rf in resource_files)

    swift_children = "\n".join(f"\t\t\t\t{uid(f'fileref:{sf}')} /* {sf.name} */," for sf in swift_files)
    resource_children = "\n".join(f"\t\t\t\t{uid(f'fileref:{rf}')} /* {rf.name} */," for rf in resource_files)
    # Built outside the big f-string: Python < 3.12 rejects backslash escapes
    # (including \") inside an f-string expression part.
    package_refs_list = "\n".join(
        f'\t\t\t\t{uid(f"pkgref:{n}")} /* XCLocalSwiftPackageReference "{n}" */,'
        for n, _ in packages
    )

    pbx = f'''// !$*UTF8*$!
{{
\tarchiveVersion = 1;
\tclasses = {{
\t}};
\tobjectVersion = 60;
\tobjects = {{

/* Begin PBXBuildFile section */
{chr(10).join(build_files_sources)}
{chr(10).join(build_files_resources)}
{chr(10).join(framework_build_files)}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
\t\t{product_ref} /* {PROJECT_NAME}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {PROJECT_NAME}.app; sourceTree = BUILT_PRODUCTS_DIR; }};
{chr(10).join(file_refs)}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
\t\t{frameworks_phase} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
{chr(10).join(framework_phase_files)}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
\t\t{main_group} = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{vaalbara_group} /* Vaalbara */,
\t\t\t\t{products_group} /* Products */,
\t\t\t);
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{products_group} /* Products */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{product_ref} /* {PROJECT_NAME}.app */,
\t\t\t);
\t\t\tname = Products;
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{vaalbara_group} /* Vaalbara */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{swift_children}
{resource_children}
\t\t\t\t{info_plist_ref} /* Info.plist */,
\t\t\t\t{entitlements_ref} /* Vaalbara.entitlements */,
\t\t\t);
\t\t\tpath = Vaalbara;
\t\t\tsourceTree = "<group>";
\t\t}};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
\t\t{target_id} /* {PROJECT_NAME} */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {target_config_list} /* Build configuration list for PBXNativeTarget "{PROJECT_NAME}" */;
\t\t\tbuildPhases = (
\t\t\t\t{sources_phase} /* Sources */,
\t\t\t\t{frameworks_phase} /* Frameworks */,
\t\t\t\t{resources_phase} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = {PROJECT_NAME};
\t\t\tpackageProductDependencies = (
{chr(10).join(target_package_deps)}
\t\t\t);
\t\t\tproductName = {PROJECT_NAME};
\t\t\tproductReference = {product_ref} /* {PROJECT_NAME}.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t{project_id} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 1600;
\t\t\t\tLastUpgradeCheck = 1600;
\t\t\t\tTargetAttributes = {{
\t\t\t\t\t{target_id} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;
\t\t\t\t\t}};
\t\t\t\t}};
\t\t\t}};
\t\t\tbuildConfigurationList = {project_config_list} /* Build configuration list for PBXProject "{PROJECT_NAME}" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = en;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\ten,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = {main_group};
\t\t\tpackageReferences = (
{package_refs_list}
\t\t\t);
\t\t\tproductRefGroup = {products_group} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\t{target_id} /* {PROJECT_NAME} */,
\t\t\t);
\t\t}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
\t\t{resources_phase} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
{resources_list}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
\t\t{sources_phase} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
{sources_list}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
\t\t{debug_config} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;
\t\t\t\tENABLE_TESTABILITY = YES;
\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tONLY_ACTIVE_ARCH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";
\t\t\t\tSWIFT_VERSION = 5.9;
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{release_config} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;
\t\t\t\tSWIFT_VERSION = 5.9;
\t\t\t\tVALIDATE_PRODUCT = YES;
\t\t\t}};
\t\t\tname = Release;
\t\t}};
\t\t{target_debug} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = Vaalbara/Vaalbara.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = "";
\t\t\t\tENABLE_PREVIEWS = NO;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = Vaalbara/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.2.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.vaalbara.thelastoasis;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
\t\t{target_release} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = Vaalbara/Vaalbara.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = "";
\t\t\t\tENABLE_PREVIEWS = NO;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = Vaalbara/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.2.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.vaalbara.thelastoasis;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = Release;
\t\t}};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\t{project_config_list} /* Build configuration list for PBXProject "{PROJECT_NAME}" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{debug_config} /* Debug */,
\t\t\t\t{release_config} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
\t\t{target_config_list} /* Build configuration list for PBXNativeTarget "{PROJECT_NAME}" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{target_debug} /* Debug */,
\t\t\t\t{target_release} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
/* End XCConfigurationList section */

/* Begin XCLocalSwiftPackageReference section */
{chr(10).join(package_refs)}
/* End XCLocalSwiftPackageReference section */

/* Begin XCSwiftPackageProductDependency section */
{chr(10).join(package_deps)}
/* End XCSwiftPackageProductDependency section */
\t}};
\trootObject = {project_id} /* Project object */;
}}
'''

    scheme_dir = OUT / "xcshareddata" / "xcschemes"
    scheme_dir.mkdir(parents=True, exist_ok=True)
    (OUT / "project.pbxproj").write_text(pbx)

    scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{target_id}"
               BuildableName = "{PROJECT_NAME}.app"
               BlueprintName = "{PROJECT_NAME}"
               ReferencedContainer = "container:{PROJECT_NAME}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = ""
      selectedLauncherIdentifier = "Xcode.IDEFoundation.Launcher.PosixSpawn"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      queueDebuggingEnabled = "No">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "{PROJECT_NAME}.app"
            BlueprintName = "{PROJECT_NAME}"
            ReferencedContainer = "container:{PROJECT_NAME}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "{PROJECT_NAME}.app"
            BlueprintName = "{PROJECT_NAME}"
            ReferencedContainer = "container:{PROJECT_NAME}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
'''
    (scheme_dir / f"{PROJECT_NAME}.xcscheme").write_text(scheme)
    print(f"Generated {OUT}")


if __name__ == "__main__":
    main()
