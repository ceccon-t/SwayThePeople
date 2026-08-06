# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-08-06

### Added

- "About" pop-up screen with links to repo and author's page

### Fixed

- Epilogue now has Retry button when an LLM request fails, like all other screens
- Councilors now receive their fitness to agendas rating even starting campaign before optional parts are generated


## [0.0.1] - 2026-07-28

### Added

- Initial release
- Full campaign loop: create a candidate, found a party with a public and a hidden agenda, hire councilors and assign their daily missions, respond to the news of the day, face the rival candidates in debates, and reach election night with per-state results and an epilogue evaluating how far the hidden agenda was advanced
- LLM-generated world and content: the nation, its states and topic areas, rival parties and candidates, daily stories, debates, surveys and campaign briefings
- Three AI engines, all configured from the in-app "AI Engine Settings" screen: Ollama (local), OpenRouter (cloud) and an offline Mock engine with canned content
- Saving and loading campaigns from the main menu

