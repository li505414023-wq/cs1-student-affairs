# CS1 项目协作规则

## 专家团队自动编排（长期生效，2026-08-09 起）

本项目已在 `.codex/agents/`、`.qoder/agents/`、`.claude/agents/` 安装 21 位工程专家（来源 agency-agents-zh，全量 268 角色存于 ~/agency-agents-zh）。

**规则：无需用户点名，按任务类型自动调用匹配专家；独立任务并行，有依赖的串行，产出汇总结论，与代码事实冲突时以代码为准。**

| 任务类型 | 自动调用 |
|---|---|
| 代码改动完成 | engineering-code-reviewer 审查 |
| 新功能/重构 | engineering-software-architect 出方案 → 开发 → testing-api-tester 补测试 |
| 上线/提交前 | engineering-security-engineer + security-appsec-engineer 双审 → testing-reality-checker 把关 |
| 数据库/慢查询 | engineering-database-optimizer |
| 部署/运维 | engineering-devops-automator、engineering-sre |
| 线上事故 | engineering-incident-response-commander 指挥 |
| 前端改动 | engineering-frontend-developer + testing-accessibility-auditor |
| 性能问题 | testing-performance-benchmarker |
| 接手陌生模块 | engineering-codebase-onboarding-engineer |

专家人设即各 agents 目录下的 .toml/.md 文件，按需读取作为角色指令。

## 质量检查

```bash
npm test          # vitest + node:test 双轨道
npm run lint
```
