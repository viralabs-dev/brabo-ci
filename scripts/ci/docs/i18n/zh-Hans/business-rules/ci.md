---
traducao_de: 1c63ebcf9d7719601a0fe7777f0d97952aa6e76e
id: rn-ci
title: 'Regras de negócio — CI'
sidebar_label: CI
description: 'As RNs hospedadas na raiz ci.'
keywords: [regras de negócio, ci]
---

# CI

本页是 `ci` 领域业务规则的索引。规则分布在各部分中（`ci/parte-NN.md`），按范围切分以便页面轻量打开；新规则放入最后一部分（ADR 0287）。

| 部分 | 起始 | 规则数 | 章节 |
|---|---|---|---|
| [第 1 部分](ci/parte-01.md) | RN-037 | 7 | PR Gates; `dbre` 角色变成两个机械脚本（RN-400..403，ADR 0093）; 仪表盘上的“N 个智能体在线”——**实时**状态，从不是历史在场（RN-409，ADR 0097）; RAG 检索留下痕迹，痕迹冻结权重（RN-479..481）; FASE 29 — 一行安装：为所发布的东西签名; 出错时; `install.sh` 完成安装（RN-547，FASE 30）; 设备密钥获得界面，界面说明吊销的范围（RN-561） |
| [第 2 部分](ci/parte-02.md) | RN-1031 | 23 | 按功能的回归测试与运行之间的关联（RN-1031..1035，RN-1043..1045）; npm 包的发布（RN-1042）; 仓库之间的合并依赖（RN-1047..1050）; 回归测试的决策报告（RN-1051..1053）; 触发器在变红之前等待印章和签名（RN-1066）; 变更面板（RN-1054..1056，ADR 0278） |

下方网格保留了旧锚点（`#rn-NNN`）：每个编号指向该规则所在的部分。

<a id="rn-037"></a>[037](ci/parte-01.md#rn-037) <a id="rn-401"></a>[401](ci/parte-01.md#rn-401) <a id="rn-411"></a>[411](ci/parte-01.md#rn-411) <a id="rn-498"></a>[498](ci/parte-01.md#rn-498) <a id="rn-524"></a>[524](ci/parte-01.md#rn-524) <a id="rn-549"></a>[549](ci/parte-01.md#rn-549) <a id="rn-565"></a>[565](ci/parte-01.md#rn-565) <a id="rn-1031"></a>[1031](ci/parte-02.md#rn-1031) <a id="rn-1032"></a>[1032](ci/parte-02.md#rn-1032) <a id="rn-1033"></a>[1033](ci/parte-02.md#rn-1033)
<a id="rn-1075"></a>[1075](ci/parte-02.md#rn-1075) <a id="rn-1034"></a>[1034](ci/parte-02.md#rn-1034) <a id="rn-1035"></a>[1035](ci/parte-02.md#rn-1035) <a id="rn-1043"></a>[1043](ci/parte-02.md#rn-1043) <a id="rn-1044"></a>[1044](ci/parte-02.md#rn-1044) <a id="rn-1045"></a>[1045](ci/parte-02.md#rn-1045) <a id="rn-1042"></a>[1042](ci/parte-02.md#rn-1042) <a id="rn-1047"></a>[1047](ci/parte-02.md#rn-1047) <a id="rn-1048"></a>[1048](ci/parte-02.md#rn-1048) <a id="rn-1049"></a>[1049](ci/parte-02.md#rn-1049)
<a id="rn-1050"></a>[1050](ci/parte-02.md#rn-1050) <a id="rn-1071"></a>[1071](ci/parte-02.md#rn-1071) <a id="rn-1072"></a>[1072](ci/parte-02.md#rn-1072) <a id="rn-1051"></a>[1051](ci/parte-02.md#rn-1051) <a id="rn-1052"></a>[1052](ci/parte-02.md#rn-1052) <a id="rn-1053"></a>[1053](ci/parte-02.md#rn-1053) <a id="rn-1066"></a>[1066](ci/parte-02.md#rn-1066) <a id="rn-1054"></a>[1054](ci/parte-02.md#rn-1054) <a id="rn-1055"></a>[1055](ci/parte-02.md#rn-1055) <a id="rn-1056"></a>[1056](ci/parte-02.md#rn-1056)
