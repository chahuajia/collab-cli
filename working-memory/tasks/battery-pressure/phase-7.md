# 阶段 7 暴露点：多厂商 IoT + 设备影子

**日期**：2026-09-17 ｜ **复杂点**：适配器隔离 · 影子读模型 · 遥测/告警 · 命令安全

## 场景边界

| 在范围内 | 不在范围内 |
| :--- | :--- |
| 2+ BMS 厂商适配 | 固件 OTA 全链路 |
| DeviceShadow 业务只读 | 互动域（直播/社区） |
| 遥测入库 + 告警工单 | 完整时序库选型实施 |
| 换电命令经适配器下发 | 渗透测试/证书 PKI 细节 |
| 支撑 phase-1 P3 按电量计量 | — |

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **P7-1** | 厂商协议不泄漏到领域层 | domain-purity · parse-dont-validate |
| **P7-2** | 业务只读 DeviceShadow | design-decision |
| **P7-3** | 统一领域事件三类 | S13 边界 |
| **P7-4** | 遥测断连 → 影子 stale 标记 | W1 故障定位 |
| **P7-5** | 命令幂等 + deviceId 认证 | A3 主动侦查 |
| **P7-6** | 时序数据与台账分离 | dependency-decision |

## 已裁决（tick 1）

| 项 | 裁决 |
| :--- | :--- |
| 适配器 | 每厂商一 `BatteryProviderAdapter` 实例 |
| 影子 freshness | `lastSeenAt` 超 **5min** → `stale=true`，UI 禁按电量计费 |
| 命令 | 必须带 `commandId` UUID，适配器去重 |
| 存储 | 台账 PostgreSQL · 遥测「时序库或 TS 表」抽象，阶段 7 不选型 |

## 成功标准

1. VendorA MQTT / VendorB HTTP 均产出相同 `BatteryTelemetryReported`
2. swap 流程读 shadow.soc，不直连厂商 API
3. stale 时 P3 计量拒绝
4. 规格完成，无运行时代码
