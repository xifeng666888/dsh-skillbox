$ErrorActionPreference = "Stop"
$sourceUrl = "https://cdn.dsh.so/market/top-rank.json"
$outputPath = Join-Path $PSScriptRoot "..\data\skills.json"
$source = Invoke-RestMethod -Uri $sourceUrl -TimeoutSec 90
$licenseByRepo = @{
  "https://github.com/qingyuna/answer-me-with-html" = "MIT"
  "https://github.com/foryourhealth111-pixel/vibe-skills" = "Apache-2.0"
  "https://github.com/hyhmrright/brooks-lint" = "MIT"
  "https://github.com/michengai/dsh-skills-manager" = "Apache-2.0"
  "https://github.com/jesse-njx/dsh-skillport" = "MIT"
  "https://github.com/satan9394/dsh-skills-bundle" = "MIT"
}

function Get-SkillCategory($plugin) {
  $text = "$($plugin.name) $($plugin.description.en) $($plugin.metadata.keywords -join ' ')".ToLower()
  if ($text -match "search|research|academic|deepread|last30days|vision") { return "联网研究" }
  if ($text -match "memory|memos|context|knowledge") { return "记忆知识" }
  if ($text -match "ppt|excel|document|html|design|video|fiction|gongwen|writing|office|remotion") { return "创作办公" }
  if ($plugin.name -match "vibe|agent-team|task-engine|agent-teams") { return "智能体" }
  if ($text -match "skill|skills") {
    if ($text -match "manager|management|market|hub|port|browser|nexus|armory|registry|tool-management") { return "技能管理" }
  }
  if ($text -match "lint|code|coding|developer|github|godot|cad|plugin-dev|review|terminal|android|game-studios") { return "开发编程" }
  if ($text -match "agent|team|workflow|orchestrat") { return "智能体" }
  return "效率工具"
}

function Get-InstallCommand($plugin, $version) {
  if ($version.source.type -eq "npm") {
    $suffix = if ($version.version) { "@$($version.version)" } else { "" }
    return "dsh plugin --profile web add $($plugin.name)$suffix"
  }
  $slug = $plugin.repository.url -replace "^https://github.com/", ""
  $pin = if ($version.source.commit) { "#$($version.source.commit)" } elseif ($version.version) { "#$($version.version)" } else { "" }
  return "dsh plugin --profile web add github:$slug$pin"
}

$items = @($source.plugins | Where-Object {
  $_.name -match "skill" -or
  $_.metadata.keywords -contains "agent-skills" -or
  $_.metadata.keywords -contains "agent-skill" -or
  $_.description.en -match "skill"
} | ForEach-Object {
  $plugin = $_
  $version = $plugin.versions[0]
  $repo = $plugin.repository.url
  $license = $licenseByRepo[$repo.ToLower()]
  $risk = if ($plugin.metadata.labels -contains "risk-low") { "low" } elseif ($plugin.metadata.labels -contains "risk-pending") { "pending" } else { "unknown" }
  [ordered]@{
    id = $plugin.name
    name = if ($plugin.title.zh) { $plugin.title.zh } elseif ($plugin.title.en) { $plugin.title.en } else { $plugin.name }
    summary = if ($plugin.description.zh) { $plugin.description.zh } else { $plugin.description.en }
    author = $plugin.author
    repo = $repo
    category = Get-SkillCategory $plugin
    keywords = @($plugin.metadata.keywords | Select-Object -First 5)
    stars = if ($plugin.metadata.sortKeys.stars) { [int]$plugin.metadata.sortKeys.stars } else { 0 }
    verified = [bool]($plugin.metadata.labels -contains "install-verified")
    risk = $risk
    version = $version.version
    install = Get-InstallCommand $plugin $version
    sourceType = $version.source.type
    commit = $version.source.commit
    dsh = $version.engines.dsh
    license = $license
  }
} | Sort-Object -Property stars -Descending)

$data = [ordered]@{
  source = [ordered]@{
    name = "dsh.so"
    url = "https://www.dsh.so/market/"
    index = $sourceUrl
    license = "CC BY 4.0"
    generatedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
  }
  count = $items.Count
  items = $items
}

$directory = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$json = $data | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText((Resolve-Path $directory).Path + "\skills.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Generated $($items.Count) skills at $outputPath"
