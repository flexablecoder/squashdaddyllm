# [PROJECT_NAME]

This is the agen service for the squashdaddy application. the main goal of this service is to provide a background process that handles integrations with the LLM and various other services like gmail, calendar, and eventually SMS. The service should primarily be using the squashdaddy API to interact with the database and other services associated with the squashdaddy application.

**ALWAYS RESPOND IN ENGLISH**

## 📋 Core Working Principles

1. For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously and in parallel.
2. Before you finish, please verify your solution
3. Do what has been asked; nothing more, nothing less.
4. NEVER create files unless they're absolutely necessary for achieving your goal.
5. ALWAYS prefer editing an existing file to creating a new one.
6. NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
7. ADDITIONAL INFO ON PROJECT CAN BE FOUND IN [./docs]
8. PROJECT STRUCTURE IS IN ./PROJECT_STRUCTURE.md

## 🏗️ Project Stack

- **[Main language/framework]** - [Node.js]
- **[Type system]** - [TypeScript]
- **[State Management]** - [N/A]
- **[Bundler]** - [N/A]
- **[Styles]** - [N/A]
- **[UI library]** - [N/A]
- **[Testing]** - [N/A]
- **[Runtime]** - [Node.js]

## 🏛️ Architectural Principles

**"As simple as possible, but not simpler"**

- **KISS + DRY + YAGNI + Occam's Razor**: each new entity must justify its existence
- **Prior-art first**: look for existing solutions first, then write our own
- **Documentation = part of code**: architectural decisions are recorded in code and comments
- **No premature optimization**
- **100% certainty**: evaluate cascading effects before changes

## 🚨 Code Quality Standards

**All code checks are mandatory - code must be ✅ CLEAN!**
No errors. No formatting issues. No compiler warnings.

**Architectural standards:**

- Minimally sufficient patterns (don't overcomplicate)
- Decomposition: break tasks into subtasks
- Cascading effects: evaluate impact of changes

## 🎯 Main Project Features

1. **[coach gmail interaction ]** - [handle custoemr emails for coaches]
2. **[calendar interaction ]** - [handle calendar events for coaches]
3. **[sms interaction ]** - [handle sms messages for coaches]
4. **[coach calendar replication ]** - [replicate squash daddy calendar events to coach's calendar]

## 🏗️ Architectural Patterns

### [Main Flow Pattern Name]

**[REad through email to understand customer intent for scheduing, pass the information to the llm for decisioning and handling of the request. interact with squashdaddy api to handle scheduling and answer questions]:**

```
[Read Email] → [LLM Decisioning] → [SquashDaddy API Interaction]
```

- [Page/Component 1] → [Page/Component 2] → [Page/Component 3]

### [Component Pattern Name]

**[Description of component architecture]:**

- **[Mode/Variant 1]** — [description] (port/URL if applicable)
- **[Mode/Variant 2]** — [description] (port/URL if applicable)

### [Data Flow Pattern]

**[Description of state management]:**

- **[State containers]**: [description]
- **[API clients]**: [description]
- **[Side effects handling]**: [description]

## 📁 Project Structure

```
[root]/
  📱 [entry point]          # Application entry point
  🧩 [components/modules]   # Main modules
  📄 [pages/views]          # Pages/views
  🔧 [config]               # Configuration
  🛠️ [utils/helpers]       # Utilities and helpers
  🏷️ [types]               # Types (if applicable)
  🎨 [styles]               # Styles
```

> 📖 **Detailed architecture**: Full structure in PROJECT_STRUCTURE.md

<details>
<summary>Expand detailed project structure</summary>

```
[Add detailed tree structure here using tree -L 3-4 output]
```

**Project Statistics:**

- 📦 **Directories**: [count]
- 📄 **Files**: [count]
- 🧪 **TypeScript/JS files**: [count]
- 🧩 **Components**: [count]
- 🧪 **Test files**: [count]

</details>

## ✅ Verification Checkpoints

**Stop and check** at these moments:

- After implementing a complete function
- Before starting a new component/module
- Before declaring "done"

Run check: `[check commands: lint, test, build]`

> Why: This prevents error accumulation and ensures code stability.

## 💻 Coding Standards

### FORBIDDEN:

- **NO any type** - use strict typing!
- **NO console.log** in production code - use proper logging!
- **NO hardcoded values** - use constants and configs!
- **NO code duplication** - reuse components and utilities!
- **NO ignoring errors** - handle all exceptions!
- **NO TODOs** in final code

### Mandatory rules:

- Always use specific types (if language supports)
- Use constants and configuration
- Reuse existing components and utilities
- Always handle exceptions
- **Meaningful names** for variables and functions
- **Early returns** to reduce nesting
- **Error handling** explicit and clear

## 📊 Implementation Standards

### Code is considered ready when:

- ✓ Build passes without errors
- ✓ All tests pass
- ✓ Formatting applied
- ✓ Compiler produces no errors/warnings
- ✓ Function works end-to-end
- ✓ Old/unused code removed
- ✓ Code is understandable to junior developer

### Testing Strategy

- Unit tests for functions and modules
- Integration tests for API/services
- E2E tests for critical functionality (if applicable)
- Critical functionality → write tests first

### **Security always**:

- Validate all external data
- Don't store sensitive data openly
- Use HTTPS/TLS for communication
- Escape user input

## 🤝 Problem Solving

When stuck or confused:

1. **Stop** - Don't overcomplicate the solution
2. **Step back** - Re-read requirements and specifications
3. **Simplify** - Simple solution is usually better
4. **Ask** - "I see two approaches: [A] vs [B]. Which aligns better with project standards?"

Your ideas for improvement are welcome - ask!

## 📘 Code Pattern Examples

### Development mode

- **localhost**: `[localhost:3000]`
- **API/Backend**: `[localhost:3001]`
- **Hot reloading**: [enabled]

## 🌟 Key Project Features

### [skills ]

- skills available to the agent are described in the ./skills/index.md file.

## 📝 Template Adaptation Instructions

When adapting this template for a specific project:

1. Replace all placeholders in square brackets `[...]` with actual values
2. Remove non-applicable sections
3. Add project-specific sections
4. Update code examples with real ones from project
5. Specify actual commands and dependencies
6. Follow KISS, Occam's razor, DRY, YAGNI principles

Template should be:

- **Minimally sufficient** - only necessary information
- **Practical** - real commands and examples
- **Current** - match project's current state
- **Clear** - understandable to any developer

---

# Important Instructions Reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
