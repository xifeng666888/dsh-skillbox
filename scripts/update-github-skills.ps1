param(
  [string]$InputPath,
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\data\skills.json"),
  [string]$SourceUrl = "https://raw.githubusercontent.com/dshworks/awesome-dsh-plugins/main/data/plugins.json"
)

$ErrorActionPreference = "Stop"
$registryName = "awesome-dsh-plugins"
$source = if ($InputPath) {
  Get-Content -Raw -Encoding UTF8 $InputPath | ConvertFrom-Json
} else {
  $downloadPath = Join-Path $PSScriptRoot "..\data\github-skills.download.json"
  try {
    & curl.exe --connect-timeout 20 --max-time 180 --retry 2 --retry-delay 2 -fsSL $SourceUrl -o $downloadPath
    if ($LASTEXITCODE -ne 0) { throw "GitHub skill registry download failed with exit code $LASTEXITCODE" }
    Get-Content -Raw -Encoding UTF8 $downloadPath | ConvertFrom-Json
  } finally {
    Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
  }
}
$current = Get-Content -Raw -Encoding UTF8 $OutputPath | ConvertFrom-Json
$curated = @($current.items | Where-Object { $_.registry -ne $registryName })
$knownRepos = @{}
foreach ($item in $curated) { $knownRepos[$item.repo.ToLower()] = $true }

function Get-RegistryCategory($skill) {
  $tags = @($skill.tags)
  if ($tags -contains "memory") { return "记忆知识" }
  if ($tags -contains "marketplace") { return "技能管理" }
  if ($tags -contains "agents") { return "智能体" }
  if ($tags -contains "knowledge") { return "联网研究" }
  if ($tags -contains "devtools" -or $tags -contains "terminal" -or $tags -contains "models" -or $tags -contains "observability" -or $tags -contains "safety" -or $tags -contains "interop") { return "开发编程" }
  if ($tags -contains "vision" -or $tags -contains "ui" -or $tags -contains "fun") { return "创作办公" }
  return "效率工具"
}

function Get-SkillName($skill, $directory) {
  $candidate = if ($directory) { Split-Path $directory -Leaf } else { $skill.name }
  $candidate = $candidate.ToLower() -replace "[^a-z0-9]+", "-" -replace "^-+|-+$", ""
  if (-not $candidate) { return "dsh-skill" }
  return $candidate
}

$githubItems = @($source.plugins | Where-Object {
  $_.category -eq "skill" -or $_.evidence -match "(?i)SKILL\.md" -or $_.name -match "(?i)skill"
} | Sort-Object -Property @{Expression={if ($_.category -eq "skill") { 0 } else { 1 }}} | ForEach-Object {
  $skill = $_
  $repo = "https://github.com/$($skill.repo)"
  if ($knownRepos.ContainsKey($repo.ToLower())) { return }
  $knownRepos[$repo.ToLower()] = $true
  $evidencePath = if ($skill.evidence) { ($skill.evidence -split "#")[0] } else { "" }
  $installType = if ($skill.official) { "source" } elseif ($skill.install) { "custom" } elseif ($skill.npm) { "npm" } elseif ($skill.category -eq "skill" -and $evidencePath -match "(?i)(^|/)SKILL\.md$") { "skill" } else { "git" }
  $install = ""
  if ($skill.install -and -not $skill.official) {
    $install = $skill.install
  } elseif ($skill.npm -and -not $skill.official) {
    $install = "dsh plugin --profile web add $($skill.npm)"
  } elseif ($installType -eq "skill") {
    $skillDirectory = $evidencePath -replace "(?i)/?SKILL\.md$", ""
    $skillName = Get-SkillName $skill $skillDirectory
    $sourceDirectory = if ($skillDirectory) { "dsh-skill-source/$skillDirectory" } else { "dsh-skill-source" }
    $install = "git clone --depth 1 $repo.git dsh-skill-source`nmkdir -p .dsh/skills`ncp -R `"$sourceDirectory`" `".dsh/skills/$skillName`""
  } elseif (-not $skill.official) {
    $install = "dsh plugin --profile web add github:$($skill.repo)"
  }
  [ordered]@{
    id = "github:$($skill.repo.ToLower())"
    name = $skill.name
    summary = $skill.description
    author = $skill.repo.Split("/")[0]
    repo = $repo
    sourcePath = $skill.path
    sourceUrl = if ($skill.path) { "$repo/tree/HEAD/$($skill.path)" } else { $repo }
    category = Get-RegistryCategory $skill
    keywords = @($skill.tags)
    stars = if ($null -ne $skill.stars) { [int]$skill.stars } else { 0 }
    verified = $skill.status -eq "verified"
    verificationType = "path"
    status = $skill.status
    risk = "unknown"
    version = $null
    install = $install
    installType = $installType
    sourceType = if ($skill.npm -and -not $skill.official) { "npm" } else { $installType }
    commit = $null
    dsh = $skill.verifiedAgainst
    license = $null
    registry = $registryName
    lastVerified = $skill.lastVerified
    evidence = $skill.evidence
    evidenceUrl = if ($evidencePath) { "$repo/blob/HEAD/$evidencePath" } else { $null }
    official = [bool]$skill.official
  }
})

$items = @($curated) + @($githubItems) | Sort-Object -Property stars -Descending
$data = [ordered]@{
  source = $current.source
  githubSource = [ordered]@{
    name = $registryName
    url = "https://github.com/dshworks/awesome-dsh-plugins"
    index = $SourceUrl
    license = "MIT"
    updated = $source.updated
    imported = $githubItems.Count
  }
  count = $items.Count
  items = $items
}
$json = $data | ConvertTo-Json -Depth 8
$directory = Split-Path -Parent $OutputPath
[System.IO.File]::WriteAllText((Resolve-Path $directory).Path + "\skills.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Merged $($curated.Count) curated and $($githubItems.Count) GitHub skills into $($items.Count) entries"
