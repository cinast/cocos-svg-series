"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGLODManager = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu, icon } = cc_1._decorator;
const SVGSpriteCache_1 = require("./SVGSpriteCache");
/**
 * SVG细节层次管理器
 * 根据距离和屏幕尺寸动态调整SVG的细节级别，优化性能
 */
let SVGLODManager = class SVGLODManager extends cc_1.Component {
    constructor() {
        // ========== LOD配置 ==========
        super(...arguments);
        this.enableLOD = true;
        this.lodLevels = [
            {
                name: "高细节",
                distanceThreshold: 10,
                screenSizeThreshold: 100,
                quality: 1.0,
                simplifyFactor: 1.0,
                updateInterval: 0.5,
            },
            {
                name: "中细节",
                distanceThreshold: 30,
                screenSizeThreshold: 50,
                quality: 0.7,
                simplifyFactor: 0.7,
                updateInterval: 1.0,
            },
            {
                name: "低细节",
                distanceThreshold: 50,
                screenSizeThreshold: 20,
                quality: 0.4,
                simplifyFactor: 0.4,
                updateInterval: 2.0,
            },
            {
                name: "极低细节",
                distanceThreshold: 100,
                screenSizeThreshold: 10,
                quality: 0.2,
                simplifyFactor: 0.2,
                updateInterval: 3.0,
            },
        ];
        this.enableDynamicUpdates = true;
        this.lodUpdateInterval = 1.0;
        // ========== 性能配置 ==========
        this.maxConcurrentUpdates = 5;
        this.enablePerformanceMonitoring = false;
        // ========== 内部状态 ==========
        this.managedSprites = new Map(); // 管理的精灵
        this.camera = null;
        this.updateTimer = 0;
        this.pendingUpdates = new Set(); // 待更新精灵
        this.updateQueue = []; // 更新队列
        this.performanceStats = {
            totalSprites: 0,
            highDetailCount: 0,
            mediumDetailCount: 0,
            lowDetailCount: 0,
            veryLowDetailCount: 0,
            lastUpdateTime: 0,
            averageUpdateTime: 0,
        };
    }
    // ========== 生命周期方法 ==========
    onLoad() {
        this.initializeLODManager();
    }
    onDestroy() {
        this.cleanupLODManager();
    }
    update(deltaTime) {
        if (!this.enableLOD)
            return;
        this.updateTimer += deltaTime;
        // 定期更新LOD
        if (this.updateTimer >= this.lodUpdateInterval) {
            this.updateLODForAllSprites();
            this.updateTimer = 0;
        }
        // 处理动态更新
        if (this.enableDynamicUpdates && this.pendingUpdates.size > 0) {
            this.processPendingUpdates();
        }
        // 更新性能监控
        if (this.enablePerformanceMonitoring) {
            this.updatePerformanceStats();
        }
    }
    // ========== 公共方法 ==========
    /**
     * 添加精灵到LOD管理
     * @param sprite 精灵组件
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     */
    addSpriteToLOD(sprite, svgContent, width, height, color) {
        if (!sprite || !sprite.node) {
            console.warn("精灵或节点无效");
            return;
        }
        const spriteId = this.generateSpriteId(sprite);
        if (!this.managedSprites.has(spriteId)) {
            const managedSprite = {
                sprite,
                node: sprite.node,
                originalSVGContent: svgContent,
                originalWidth: width,
                originalHeight: height,
                originalColor: color,
                currentLODLevel: 0,
                lastUpdateTime: 0,
                distanceToCamera: 0,
                screenSize: 0,
                isVisible: true,
            };
            this.managedSprites.set(spriteId, managedSprite);
            // 初始LOD评估
            this.evaluateAndApplyLOD(spriteId).catch(console.error);
            console.log(`精灵已添加到LOD管理: ${spriteId}`);
        }
    }
    /**
     * 从LOD管理移除精灵
     * @param sprite 精灵组件
     */
    removeSpriteFromLOD(sprite) {
        const spriteId = this.generateSpriteId(sprite);
        if (this.managedSprites.has(spriteId)) {
            this.managedSprites.delete(spriteId);
            console.log(`精灵已从LOD管理移除: ${spriteId}`);
        }
    }
    /**
     * 强制更新指定精灵的LOD
     * @param sprite 精灵组件
     */
    async forceUpdateLOD(sprite) {
        const spriteId = this.generateSpriteId(sprite);
        if (this.managedSprites.has(spriteId)) {
            await this.evaluateAndApplyLOD(spriteId);
        }
    }
    /**
     * 批量添加精灵到LOD管理
     * @param sprites 精灵数组
     */
    addSpritesToLOD(sprites) {
        sprites.forEach((spriteData) => {
            this.addSpriteToLOD(spriteData.sprite, spriteData.svgContent, spriteData.width, spriteData.height, spriteData.color);
        });
    }
    /**
     * 获取精灵的当前LOD级别
     * @param sprite 精灵组件
     * @returns LOD级别索引，-1表示未找到
     */
    getSpriteLODLevel(sprite) {
        const spriteId = this.generateSpriteId(sprite);
        const managedSprite = this.managedSprites.get(spriteId);
        return managedSprite ? managedSprite.currentLODLevel : -1;
    }
    /**
     * 获取LOD级别信息
     * @param levelIndex LOD级别索引
     * @returns LOD级别信息
     */
    getLODLevelInfo(levelIndex) {
        if (levelIndex >= 0 && levelIndex < this.lodLevels.length) {
            return this.lodLevels[levelIndex];
        }
        return null;
    }
    /**
     * 获取性能统计
     */
    getPerformanceStats() {
        // 更新统计
        this.performanceStats.totalSprites = this.managedSprites.size;
        let high = 0, medium = 0, low = 0, veryLow = 0;
        this.managedSprites.forEach((sprite) => {
            switch (sprite.currentLODLevel) {
                case 0:
                    high++;
                    break;
                case 1:
                    medium++;
                    break;
                case 2:
                    low++;
                    break;
                case 3:
                    veryLow++;
                    break;
            }
        });
        this.performanceStats.highDetailCount = high;
        this.performanceStats.mediumDetailCount = medium;
        this.performanceStats.lowDetailCount = low;
        this.performanceStats.veryLowDetailCount = veryLow;
        return Object.assign({}, this.performanceStats);
    }
    /**
     * 设置LOD级别配置
     * @param levels 新的LOD级别配置
     */
    setLODLevels(levels) {
        if (levels.length > 0) {
            this.lodLevels = levels;
            console.log("LOD级别配置已更新");
            // 重新评估所有精灵
            this.updateLODForAllSprites();
        }
    }
    /**
     * 优化特定区域内的精灵
     * @param center 中心位置
     * @param radius 半径
     */
    async optimizeArea(center, radius) {
        const promises = [];
        this.managedSprites.forEach((sprite, spriteId) => {
            if (sprite.node && sprite.node.isValid) {
                const spritePos = sprite.node.worldPosition;
                const distance = spritePos.subtract(center).length();
                if (distance <= radius) {
                    promises.push(this.optimizeSpriteLOD(spriteId));
                }
            }
        });
        await Promise.all(promises);
    }
    // ========== 私有方法 ==========
    /**
     * 初始化LOD管理器
     */
    initializeLODManager() {
        var _a;
        this.managedSprites.clear();
        this.pendingUpdates.clear();
        this.updateQueue = [];
        this.updateTimer = 0;
        // 获取主相机
        this.camera = ((_a = cc_1.director.getScene()) === null || _a === void 0 ? void 0 : _a.getComponentInChildren(cc_1.Camera)) || null;
        console.log("SVGLODManager 初始化完成");
    }
    /**
     * 清理LOD管理器
     */
    cleanupLODManager() {
        this.managedSprites.clear();
        this.pendingUpdates.clear();
        this.updateQueue = [];
        console.log("SVGLODManager 清理完成");
    }
    /**
     * 生成精灵ID
     */
    generateSpriteId(sprite) {
        var _a;
        return `${((_a = sprite.node) === null || _a === void 0 ? void 0 : _a.uuid) || "unknown"}_${sprite.uuid}`;
    }
    /**
     * 更新所有精灵的LOD
     */
    updateLODForAllSprites() {
        if (!this.enableLOD)
            return;
        this.managedSprites.forEach((sprite, spriteId) => {
            // 检查是否需要更新
            const currentTime = Date.now() / 1000;
            const timeSinceLastUpdate = currentTime - sprite.lastUpdateTime;
            const lodLevel = this.lodLevels[sprite.currentLODLevel];
            if (timeSinceLastUpdate >= lodLevel.updateInterval) {
                this.pendingUpdates.add(spriteId);
            }
        });
    }
    /**
     * 处理待更新精灵
     */
    processPendingUpdates() {
        if (this.pendingUpdates.size === 0)
            return;
        // 将待更新精灵添加到队列
        this.pendingUpdates.forEach((spriteId) => {
            if (!this.updateQueue.includes(spriteId)) {
                this.updateQueue.push(spriteId);
            }
        });
        this.pendingUpdates.clear();
        // 处理队列中的精灵（限制并发数量）
        const concurrentLimit = Math.min(this.maxConcurrentUpdates, this.updateQueue.length);
        for (let i = 0; i < concurrentLimit; i++) {
            const spriteId = this.updateQueue.shift();
            if (spriteId) {
                this.evaluateAndApplyLOD(spriteId).catch(console.error);
            }
        }
    }
    /**
     * 评估并应用LOD
     */
    async evaluateAndApplyLOD(spriteId) {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite || !managedSprite.sprite.isValid) {
            return;
        }
        try {
            // 评估LOD级别
            const lodLevelIndex = this.evaluateLODLevel(managedSprite);
            // 如果LOD级别发生变化，应用新的LOD
            if (lodLevelIndex !== managedSprite.currentLODLevel) {
                await this.applyLODLevel(spriteId, lodLevelIndex);
                managedSprite.currentLODLevel = lodLevelIndex;
            }
            // 更新最后更新时间
            managedSprite.lastUpdateTime = Date.now() / 1000;
        }
        catch (error) {
            console.error(`评估LOD失败 (${spriteId}):`, error);
        }
    }
    /**
     * 评估LOD级别
     */
    evaluateLODLevel(sprite) {
        var _a;
        if (!this.camera || !sprite.node) {
            return 0; // 默认最高细节
        }
        // 计算距离
        const cameraPos = ((_a = this.camera.node) === null || _a === void 0 ? void 0 : _a.worldPosition) || new cc_1.Vec3(0, 0, 0);
        const spritePos = sprite.node.worldPosition;
        sprite.distanceToCamera = spritePos.subtract(cameraPos).length();
        // 计算屏幕尺寸
        sprite.screenSize = this.calculateScreenSize(sprite);
        // 检查可见性
        sprite.isVisible = this.isSpriteVisible(sprite);
        if (!sprite.isVisible) {
            return this.lodLevels.length - 1; // 不可见时使用最低细节
        }
        // 根据距离和屏幕尺寸确定LOD级别
        for (let i = 0; i < this.lodLevels.length; i++) {
            const level = this.lodLevels[i];
            if (sprite.distanceToCamera <= level.distanceThreshold && sprite.screenSize >= level.screenSizeThreshold) {
                return i;
            }
        }
        // 如果都不满足，返回最低细节级别
        return this.lodLevels.length - 1;
    }
    /**
     * 计算屏幕尺寸
     */
    calculateScreenSize(sprite) {
        if (!this.camera || !sprite.node) {
            return sprite.originalWidth * sprite.originalHeight;
        }
        // 简化实现：使用节点尺寸
        const uiTransform = sprite.node.getComponent(cc_1.UITransform);
        if (uiTransform) {
            return uiTransform.width * uiTransform.height;
        }
        return sprite.originalWidth * sprite.originalHeight;
    }
    /**
     * 检查精灵是否可见
     */
    isSpriteVisible(sprite) {
        if (!sprite.node)
            return false;
        // 简化实现：检查节点是否激活且在场景中
        return sprite.node.active && sprite.node.isValid;
    }
    /**
     * 应用LOD级别
     */
    async applyLODLevel(spriteId, lodLevelIndex) {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite || !managedSprite.sprite.isValid) {
            return;
        }
        const lodLevel = this.lodLevels[lodLevelIndex];
        if (!lodLevel) {
            console.warn(`无效的LOD级别: ${lodLevelIndex}`);
            return;
        }
        try {
            // 计算简化后的尺寸
            const simplifiedWidth = Math.max(1, Math.floor(managedSprite.originalWidth * lodLevel.simplifyFactor));
            const simplifiedHeight = Math.max(1, Math.floor(managedSprite.originalHeight * lodLevel.simplifyFactor));
            // 获取简化后的SVG精灵帧
            const spriteFrame = await SVGSpriteCache_1.SVGSpriteCache.getSVGSpriteFrame(managedSprite.originalSVGContent, simplifiedWidth, simplifiedHeight, managedSprite.originalColor, lodLevel.quality);
            if (spriteFrame && managedSprite.sprite.isValid) {
                managedSprite.sprite.spriteFrame = spriteFrame;
                console.log(`LOD更新: ${spriteId} -> ${lodLevel.name} (${simplifiedWidth}x${simplifiedHeight})`);
            }
        }
        catch (error) {
            console.error(`应用LOD级别失败 (${spriteId}):`, error);
        }
    }
    /**
     * 优化精灵LOD
     */
    async optimizeSpriteLOD(spriteId) {
        const managedSprite = this.managedSprites.get(spriteId);
        if (!managedSprite)
            return;
        // 重新评估LOD级别
        const newLodLevel = this.evaluateLODLevel(managedSprite);
        // 如果当前级别不是最优，应用新的LOD级别
        if (newLodLevel !== managedSprite.currentLODLevel) {
            await this.applyLODLevel(spriteId, newLodLevel);
            managedSprite.currentLODLevel = newLodLevel;
        }
    }
    /**
     * 更新性能统计
     */
    updatePerformanceStats() {
        const stats = this.getPerformanceStats();
        // 定期输出性能信息
        const currentTime = Date.now() / 1000;
        if (currentTime - this.performanceStats.lastUpdateTime >= 5) {
            // 每5秒输出一次
            console.log(`LOD性能统计:
                总精灵数: ${stats.totalSprites}
                高细节: ${stats.highDetailCount}
                中细节: ${stats.mediumDetailCount}
                低细节: ${stats.lowDetailCount}
                极低细节: ${stats.veryLowDetailCount}
            `);
            this.performanceStats.lastUpdateTime = currentTime;
        }
    }
};
exports.SVGLODManager = SVGLODManager;
__decorate([
    property({
        tooltip: "启用LOD系统",
        displayName: "启用LOD",
    })
], SVGLODManager.prototype, "enableLOD", void 0);
__decorate([
    property({
        tooltip: "LOD级别配置",
        displayName: "LOD级别",
    })
], SVGLODManager.prototype, "lodLevels", void 0);
__decorate([
    property({
        tooltip: "启用动态LOD更新",
        displayName: "动态更新",
    })
], SVGLODManager.prototype, "enableDynamicUpdates", void 0);
__decorate([
    property({
        tooltip: "LOD更新间隔（秒）",
        displayName: "更新间隔",
        min: 0.1,
        max: 5.0,
    })
], SVGLODManager.prototype, "lodUpdateInterval", void 0);
__decorate([
    property({
        tooltip: "最大同时更新数量",
        displayName: "最大更新数",
        min: 1,
        max: 20,
    })
], SVGLODManager.prototype, "maxConcurrentUpdates", void 0);
__decorate([
    property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
], SVGLODManager.prototype, "enablePerformanceMonitoring", void 0);
exports.SVGLODManager = SVGLODManager = __decorate([
    ccclass("SVGLODManager"),
    icon("../../Inkpen_stroke.png"),
    menu("2D/SVGLODManager"),
    executeInEditMode
], SVGLODManager);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHTE9ETWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS9jb21wb25lbnRzL1NWR0xPRE1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsMkJBQThGO0FBQzlGLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFVLENBQUM7QUFFeEUscURBQWtEO0FBK0JsRDs7O0dBR0c7QUFLSSxJQUFNLGFBQWEsR0FBbkIsTUFBTSxhQUFjLFNBQVEsY0FBUztJQUFyQztRQUNILDhCQUE4Qjs7UUFNdEIsY0FBUyxHQUFZLElBQUksQ0FBQztRQU0xQixjQUFTLEdBQWU7WUFDNUI7Z0JBQ0ksSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsaUJBQWlCLEVBQUUsRUFBRTtnQkFDckIsbUJBQW1CLEVBQUUsR0FBRztnQkFDeEIsT0FBTyxFQUFFLEdBQUc7Z0JBQ1osY0FBYyxFQUFFLEdBQUc7Z0JBQ25CLGNBQWMsRUFBRSxHQUFHO2FBQ3RCO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsaUJBQWlCLEVBQUUsRUFBRTtnQkFDckIsbUJBQW1CLEVBQUUsRUFBRTtnQkFDdkIsT0FBTyxFQUFFLEdBQUc7Z0JBQ1osY0FBYyxFQUFFLEdBQUc7Z0JBQ25CLGNBQWMsRUFBRSxHQUFHO2FBQ3RCO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsaUJBQWlCLEVBQUUsRUFBRTtnQkFDckIsbUJBQW1CLEVBQUUsRUFBRTtnQkFDdkIsT0FBTyxFQUFFLEdBQUc7Z0JBQ1osY0FBYyxFQUFFLEdBQUc7Z0JBQ25CLGNBQWMsRUFBRSxHQUFHO2FBQ3RCO1lBQ0Q7Z0JBQ0ksSUFBSSxFQUFFLE1BQU07Z0JBQ1osaUJBQWlCLEVBQUUsR0FBRztnQkFDdEIsbUJBQW1CLEVBQUUsRUFBRTtnQkFDdkIsT0FBTyxFQUFFLEdBQUc7Z0JBQ1os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O0tBQ3ZCLENBQUM7Z0RBQ2dDO0FBTTFCO0lBSlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFNBQVM7UUFDbEIsV0FBVyxFQUFFLE9BQU87S0FDdkIsQ0FBQztnREFrQ0E7QUFNTTtJQUpQLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxXQUFXO1FBQ3BCLFdBQVcsRUFBRSxNQUFNO0tBQ3RCLENBQUM7MkRBQzJDO0FBUXJDO0lBTlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFlBQVk7UUFDckIsV0FBVyxFQUFFLE1BQU07UUFDbkIsR0FBRyxFQUFFLEdBQUc7UUFDUixHQUFHLEVBQUUsR0FBRztLQUNYLENBQUM7d0RBQ3NDO0FBVWhDO0lBTlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFVBQVU7UUFDbkIsV0FBVyxFQUFFLE9BQU87UUFDcEIsR0FBRyxFQUFFLENBQUM7UUFDTixHQUFHLEVBQUUsRUFBRTtLQUNWLENBQUM7MkRBQ3VDO0FBTWpDO0lBSlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFFBQVE7UUFDakIsV0FBVyxFQUFFLE1BQU07S0FDdEIsQ0FBQztrRUFDbUQ7d0JBNUU1QyxhQUFhO0lBSnpCLE9BQU8sQ0FBQyxlQUFlLENBQUM7SUFDeEIsSUFBSSxDQUFDLHlCQUF5QixDQUFDO0lBQy9CLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUN4QixpQkFBaUI7R0FDTCxhQUFhLENBMGlCekIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIE5vZGUsIFNwcml0ZSwgQ2FtZXJhLCBWZWMzLCBkaXJlY3RvciwgVUlUcmFuc2Zvcm0gfSBmcm9tIFwiY2NcIjtcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUsIGljb24gfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5pbXBvcnQgeyBTVkdTcHJpdGVDYWNoZSB9IGZyb20gXCIuL1NWR1Nwcml0ZUNhY2hlXCI7XHJcblxyXG4vKipcclxuICogTE9E57qn5Yir6YWN572uXHJcbiAqL1xyXG5pbnRlcmZhY2UgTE9ETGV2ZWwge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgZGlzdGFuY2VUaHJlc2hvbGQ6IG51bWJlcjsgLy8g6Led56a76ZiI5YC8XHJcbiAgICBzY3JlZW5TaXplVGhyZXNob2xkOiBudW1iZXI7IC8vIOWxj+W5leWwuuWvuOmYiOWAvO+8iOWDj+e0oO+8iVxyXG4gICAgcXVhbGl0eTogbnVtYmVyOyAvLyDotKjph4/nuqfliKvvvIgwLTHvvIlcclxuICAgIHNpbXBsaWZ5RmFjdG9yOiBudW1iZXI7IC8vIOeugOWMluWboOWtkO+8iDAtMe+8jDHooajnpLrkuI3nroDljJbvvIlcclxuICAgIHVwZGF0ZUludGVydmFsOiBudW1iZXI7IC8vIOabtOaWsOmXtOmalO+8iOenku+8iVxyXG59XHJcblxyXG4vKipcclxuICog566h55CG57K+54G15o6l5Y+jXHJcbiAqL1xyXG5pbnRlcmZhY2UgTWFuYWdlZFNwcml0ZSB7XHJcbiAgICBzcHJpdGU6IFNwcml0ZTtcclxuICAgIG5vZGU6IE5vZGU7XHJcbiAgICBvcmlnaW5hbFNWR0NvbnRlbnQ6IHN0cmluZztcclxuICAgIG9yaWdpbmFsV2lkdGg6IG51bWJlcjtcclxuICAgIG9yaWdpbmFsSGVpZ2h0OiBudW1iZXI7XHJcbiAgICBvcmlnaW5hbENvbG9yPzogc3RyaW5nO1xyXG4gICAgY3VycmVudExPRExldmVsOiBudW1iZXI7XHJcbiAgICBsYXN0VXBkYXRlVGltZTogbnVtYmVyO1xyXG4gICAgZGlzdGFuY2VUb0NhbWVyYTogbnVtYmVyO1xyXG4gICAgc2NyZWVuU2l6ZTogbnVtYmVyO1xyXG4gICAgaXNWaXNpYmxlOiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogU1ZH57uG6IqC5bGC5qyh566h55CG5ZmoXHJcbiAqIOagueaNrui3neemu+WSjOWxj+W5leWwuuWvuOWKqOaAgeiwg+aVtFNWR+eahOe7huiKgue6p+WIq++8jOS8mOWMluaAp+iDvVxyXG4gKi9cclxuQGNjY2xhc3MoXCJTVkdMT0RNYW5hZ2VyXCIpXHJcbkBpY29uKFwiLi4vLi4vSW5rcGVuX3N0cm9rZS5wbmdcIilcclxuQG1lbnUoXCIyRC9TVkdMT0RNYW5hZ2VyXCIpXHJcbkBleGVjdXRlSW5FZGl0TW9kZVxyXG5leHBvcnQgY2xhc3MgU1ZHTE9ETWFuYWdlciBleHRlbmRzIENvbXBvbmVudCB7XHJcbiAgICAvLyA9PT09PT09PT09IExPROmFjee9riA9PT09PT09PT09XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqExPROezu+e7n1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuWQr+eUqExPRFwiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgZW5hYmxlTE9EOiBib29sZWFuID0gdHJ1ZTtcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwiTE9E57qn5Yir6YWN572uXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwiTE9E57qn5YirXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBsb2RMZXZlbHM6IExPRExldmVsW10gPSBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBuYW1lOiBcIumrmOe7huiKglwiLFxyXG4gICAgICAgICAgICBkaXN0YW5jZVRocmVzaG9sZDogMTAsXHJcbiAgICAgICAgICAgIHNjcmVlblNpemVUaHJlc2hvbGQ6IDEwMCxcclxuICAgICAgICAgICAgcXVhbGl0eTogMS4wLFxyXG4gICAgICAgICAgICBzaW1wbGlmeUZhY3RvcjogMS4wLFxyXG4gICAgICAgICAgICB1cGRhdGVJbnRlcnZhbDogMC41LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBuYW1lOiBcIuS4ree7huiKglwiLFxyXG4gICAgICAgICAgICBkaXN0YW5jZVRocmVzaG9sZDogMzAsXHJcbiAgICAgICAgICAgIHNjcmVlblNpemVUaHJlc2hvbGQ6IDUwLFxyXG4gICAgICAgICAgICBxdWFsaXR5OiAwLjcsXHJcbiAgICAgICAgICAgIHNpbXBsaWZ5RmFjdG9yOiAwLjcsXHJcbiAgICAgICAgICAgIHVwZGF0ZUludGVydmFsOiAxLjAsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIG5hbWU6IFwi5L2O57uG6IqCXCIsXHJcbiAgICAgICAgICAgIGRpc3RhbmNlVGhyZXNob2xkOiA1MCxcclxuICAgICAgICAgICAgc2NyZWVuU2l6ZVRocmVzaG9sZDogMjAsXHJcbiAgICAgICAgICAgIHF1YWxpdHk6IDAuNCxcclxuICAgICAgICAgICAgc2ltcGxpZnlGYWN0b3I6IDAuNCxcclxuICAgICAgICAgICAgdXBkYXRlSW50ZXJ2YWw6IDIuMCxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCLmnoHkvY7nu4boioJcIixcclxuICAgICAgICAgICAgZGlzdGFuY2VUaHJlc2hvbGQ6IDEwMCxcclxuICAgICAgICAgICAgc2NyZWVuU2l6ZVRocmVzaG9sZDogMTAsXHJcbiAgICAgICAgICAgIHF1YWxpdHk6IDAuMixcclxuICAgICAgICAgICAgc2ltcGxpZnlGYWN0b3I6IDAuMixcclxuICAgICAgICAgICAgdXBkYXRlSW50ZXJ2YWw6IDMuMCxcclxuICAgICAgICB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So5Yqo5oCBTE9E5pu05pawXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5Yqo5oCB5pu05pawXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBlbmFibGVEeW5hbWljVXBkYXRlczogYm9vbGVhbiA9IHRydWU7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIkxPROabtOaWsOmXtOmalO+8iOenku+8iVwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuabtOaWsOmXtOmalFwiLFxyXG4gICAgICAgIG1pbjogMC4xLFxyXG4gICAgICAgIG1heDogNS4wLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgbG9kVXBkYXRlSW50ZXJ2YWw6IG51bWJlciA9IDEuMDtcclxuXHJcbiAgICAvLyA9PT09PT09PT09IOaAp+iDvemFjee9riA9PT09PT09PT09XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuacgOWkp+WQjOaXtuabtOaWsOaVsOmHj1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuacgOWkp+abtOaWsOaVsFwiLFxyXG4gICAgICAgIG1pbjogMSxcclxuICAgICAgICBtYXg6IDIwLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgbWF4Q29uY3VycmVudFVwZGF0ZXM6IG51bWJlciA9IDU7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqOaAp+iDveebkeaOp1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuaAp+iDveebkeaOp1wiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgZW5hYmxlUGVyZm9ybWFuY2VNb25pdG9yaW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhoXpg6jnirbmgIEgPT09PT09PT09PVxyXG5cclxuICAgIHByaXZhdGUgbWFuYWdlZFNwcml0ZXM6IE1hcDxzdHJpbmcsIE1hbmFnZWRTcHJpdGU+ID0gbmV3IE1hcCgpOyAvLyDnrqHnkIbnmoTnsr7ngbVcclxuICAgIHByaXZhdGUgY2FtZXJhOiBDYW1lcmEgfCBudWxsID0gbnVsbDtcclxuICAgIHByaXZhdGUgdXBkYXRlVGltZXI6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIHBlbmRpbmdVcGRhdGVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTsgLy8g5b6F5pu05paw57K+54G1XHJcbiAgICBwcml2YXRlIHVwZGF0ZVF1ZXVlOiBzdHJpbmdbXSA9IFtdOyAvLyDmm7TmlrDpmJ/liJdcclxuXHJcbiAgICBwcml2YXRlIHBlcmZvcm1hbmNlU3RhdHMgPSB7XHJcbiAgICAgICAgdG90YWxTcHJpdGVzOiAwLFxyXG4gICAgICAgIGhpZ2hEZXRhaWxDb3VudDogMCxcclxuICAgICAgICBtZWRpdW1EZXRhaWxDb3VudDogMCxcclxuICAgICAgICBsb3dEZXRhaWxDb3VudDogMCxcclxuICAgICAgICB2ZXJ5TG93RGV0YWlsQ291bnQ6IDAsXHJcbiAgICAgICAgbGFzdFVwZGF0ZVRpbWU6IDAsXHJcbiAgICAgICAgYXZlcmFnZVVwZGF0ZVRpbWU6IDAsXHJcbiAgICB9O1xyXG5cclxuICAgIC8vID09PT09PT09PT0g55Sf5ZG95ZGo5pyf5pa55rOVID09PT09PT09PT1cclxuXHJcbiAgICBvbkxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplTE9ETWFuYWdlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIG9uRGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmNsZWFudXBMT0RNYW5hZ2VyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlKGRlbHRhVGltZTogbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZUxPRCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLnVwZGF0ZVRpbWVyICs9IGRlbHRhVGltZTtcclxuXHJcbiAgICAgICAgLy8g5a6a5pyf5pu05pawTE9EXHJcbiAgICAgICAgaWYgKHRoaXMudXBkYXRlVGltZXIgPj0gdGhpcy5sb2RVcGRhdGVJbnRlcnZhbCkge1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxPREZvckFsbFNwcml0ZXMoKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVUaW1lciA9IDA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDlpITnkIbliqjmgIHmm7TmlrBcclxuICAgICAgICBpZiAodGhpcy5lbmFibGVEeW5hbWljVXBkYXRlcyAmJiB0aGlzLnBlbmRpbmdVcGRhdGVzLnNpemUgPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc1BlbmRpbmdVcGRhdGVzKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmm7TmlrDmgKfog73nm5HmjqdcclxuICAgICAgICBpZiAodGhpcy5lbmFibGVQZXJmb3JtYW5jZU1vbml0b3JpbmcpIHtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVQZXJmb3JtYW5jZVN0YXRzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vID09PT09PT09PT0g5YWs5YWx5pa55rOVID09PT09PT09PT1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa3u+WKoOeyvueBteWIsExPROeuoeeQhlxyXG4gICAgICogQHBhcmFtIHNwcml0ZSDnsr7ngbXnu4Tku7ZcclxuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuuVxyXG4gICAgICogQHBhcmFtIHdpZHRoIOWuveW6plxyXG4gICAgICogQHBhcmFtIGhlaWdodCDpq5jluqZcclxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFkZFNwcml0ZVRvTE9EKHNwcml0ZTogU3ByaXRlLCBzdmdDb250ZW50OiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIGlmICghc3ByaXRlIHx8ICFzcHJpdGUubm9kZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLnsr7ngbXmiJboioLngrnml6DmlYhcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHNwcml0ZUlkID0gdGhpcy5nZW5lcmF0ZVNwcml0ZUlkKHNwcml0ZSk7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5tYW5hZ2VkU3ByaXRlcy5oYXMoc3ByaXRlSWQpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hbmFnZWRTcHJpdGU6IE1hbmFnZWRTcHJpdGUgPSB7XHJcbiAgICAgICAgICAgICAgICBzcHJpdGUsXHJcbiAgICAgICAgICAgICAgICBub2RlOiBzcHJpdGUubm9kZSxcclxuICAgICAgICAgICAgICAgIG9yaWdpbmFsU1ZHQ29udGVudDogc3ZnQ29udGVudCxcclxuICAgICAgICAgICAgICAgIG9yaWdpbmFsV2lkdGg6IHdpZHRoLFxyXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxIZWlnaHQ6IGhlaWdodCxcclxuICAgICAgICAgICAgICAgIG9yaWdpbmFsQ29sb3I6IGNvbG9yLFxyXG4gICAgICAgICAgICAgICAgY3VycmVudExPRExldmVsOiAwLFxyXG4gICAgICAgICAgICAgICAgbGFzdFVwZGF0ZVRpbWU6IDAsXHJcbiAgICAgICAgICAgICAgICBkaXN0YW5jZVRvQ2FtZXJhOiAwLFxyXG4gICAgICAgICAgICAgICAgc2NyZWVuU2l6ZTogMCxcclxuICAgICAgICAgICAgICAgIGlzVmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMubWFuYWdlZFNwcml0ZXMuc2V0KHNwcml0ZUlkLCBtYW5hZ2VkU3ByaXRlKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOWIneWni0xPROivhOS8sFxyXG4gICAgICAgICAgICB0aGlzLmV2YWx1YXRlQW5kQXBwbHlMT0Qoc3ByaXRlSWQpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYOeyvueBteW3sua3u+WKoOWIsExPROeuoeeQhjogJHtzcHJpdGVJZH1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDku45MT0TnrqHnkIbnp7vpmaTnsr7ngbVcclxuICAgICAqIEBwYXJhbSBzcHJpdGUg57K+54G157uE5Lu2XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyByZW1vdmVTcHJpdGVGcm9tTE9EKHNwcml0ZTogU3ByaXRlKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3Qgc3ByaXRlSWQgPSB0aGlzLmdlbmVyYXRlU3ByaXRlSWQoc3ByaXRlKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMubWFuYWdlZFNwcml0ZXMuaGFzKHNwcml0ZUlkKSkge1xyXG4gICAgICAgICAgICB0aGlzLm1hbmFnZWRTcHJpdGVzLmRlbGV0ZShzcHJpdGVJZCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGDnsr7ngbXlt7Lku45MT0TnrqHnkIbnp7vpmaQ6ICR7c3ByaXRlSWR9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5by65Yi25pu05paw5oyH5a6a57K+54G155qETE9EXHJcbiAgICAgKiBAcGFyYW0gc3ByaXRlIOeyvueBtee7hOS7tlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgZm9yY2VVcGRhdGVMT0Qoc3ByaXRlOiBTcHJpdGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBzcHJpdGVJZCA9IHRoaXMuZ2VuZXJhdGVTcHJpdGVJZChzcHJpdGUpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5tYW5hZ2VkU3ByaXRlcy5oYXMoc3ByaXRlSWQpKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZXZhbHVhdGVBbmRBcHBseUxPRChzcHJpdGVJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5om56YeP5re75Yqg57K+54G15YiwTE9E566h55CGXHJcbiAgICAgKiBAcGFyYW0gc3ByaXRlcyDnsr7ngbXmlbDnu4RcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFkZFNwcml0ZXNUb0xPRChcclxuICAgICAgICBzcHJpdGVzOiBBcnJheTx7XHJcbiAgICAgICAgICAgIHNwcml0ZTogU3ByaXRlO1xyXG4gICAgICAgICAgICBzdmdDb250ZW50OiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XHJcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xyXG4gICAgICAgICAgICBjb2xvcj86IHN0cmluZztcclxuICAgICAgICB9PlxyXG4gICAgKTogdm9pZCB7XHJcbiAgICAgICAgc3ByaXRlcy5mb3JFYWNoKChzcHJpdGVEYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkU3ByaXRlVG9MT0Qoc3ByaXRlRGF0YS5zcHJpdGUsIHNwcml0ZURhdGEuc3ZnQ29udGVudCwgc3ByaXRlRGF0YS53aWR0aCwgc3ByaXRlRGF0YS5oZWlnaHQsIHNwcml0ZURhdGEuY29sb3IpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W57K+54G155qE5b2T5YmNTE9E57qn5YirXHJcbiAgICAgKiBAcGFyYW0gc3ByaXRlIOeyvueBtee7hOS7tlxyXG4gICAgICogQHJldHVybnMgTE9E57qn5Yir57Si5byV77yMLTHooajnpLrmnKrmib7liLBcclxuICAgICAqL1xyXG4gICAgcHVibGljIGdldFNwcml0ZUxPRExldmVsKHNwcml0ZTogU3ByaXRlKTogbnVtYmVyIHtcclxuICAgICAgICBjb25zdCBzcHJpdGVJZCA9IHRoaXMuZ2VuZXJhdGVTcHJpdGVJZChzcHJpdGUpO1xyXG4gICAgICAgIGNvbnN0IG1hbmFnZWRTcHJpdGUgPSB0aGlzLm1hbmFnZWRTcHJpdGVzLmdldChzcHJpdGVJZCk7XHJcblxyXG4gICAgICAgIHJldHVybiBtYW5hZ2VkU3ByaXRlID8gbWFuYWdlZFNwcml0ZS5jdXJyZW50TE9ETGV2ZWwgOiAtMTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPlkxPROe6p+WIq+S/oeaBr1xyXG4gICAgICogQHBhcmFtIGxldmVsSW5kZXggTE9E57qn5Yir57Si5byVXHJcbiAgICAgKiBAcmV0dXJucyBMT0TnuqfliKvkv6Hmga9cclxuICAgICAqL1xyXG4gICAgcHVibGljIGdldExPRExldmVsSW5mbyhsZXZlbEluZGV4OiBudW1iZXIpOiBMT0RMZXZlbCB8IG51bGwge1xyXG4gICAgICAgIGlmIChsZXZlbEluZGV4ID49IDAgJiYgbGV2ZWxJbmRleCA8IHRoaXMubG9kTGV2ZWxzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5sb2RMZXZlbHNbbGV2ZWxJbmRleF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5oCn6IO957uf6K6hXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBnZXRQZXJmb3JtYW5jZVN0YXRzKCk6IHR5cGVvZiB0aGlzLnBlcmZvcm1hbmNlU3RhdHMge1xyXG4gICAgICAgIC8vIOabtOaWsOe7n+iuoVxyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbFNwcml0ZXMgPSB0aGlzLm1hbmFnZWRTcHJpdGVzLnNpemU7XHJcblxyXG4gICAgICAgIGxldCBoaWdoID0gMCxcclxuICAgICAgICAgICAgbWVkaXVtID0gMCxcclxuICAgICAgICAgICAgbG93ID0gMCxcclxuICAgICAgICAgICAgdmVyeUxvdyA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMubWFuYWdlZFNwcml0ZXMuZm9yRWFjaCgoc3ByaXRlKSA9PiB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAoc3ByaXRlLmN1cnJlbnRMT0RMZXZlbCkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgIGhpZ2grKztcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgICAgICBtZWRpdW0rKztcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgICAgICAgICAgICBsb3crKztcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgICAgICAgICB2ZXJ5TG93Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmhpZ2hEZXRhaWxDb3VudCA9IGhpZ2g7XHJcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLm1lZGl1bURldGFpbENvdW50ID0gbWVkaXVtO1xyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5sb3dEZXRhaWxDb3VudCA9IGxvdztcclxuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudmVyeUxvd0RldGFpbENvdW50ID0gdmVyeUxvdztcclxuXHJcbiAgICAgICAgcmV0dXJuIHsgLi4udGhpcy5wZXJmb3JtYW5jZVN0YXRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDorr7nva5MT0TnuqfliKvphY3nva5cclxuICAgICAqIEBwYXJhbSBsZXZlbHMg5paw55qETE9E57qn5Yir6YWN572uXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzZXRMT0RMZXZlbHMobGV2ZWxzOiBMT0RMZXZlbFtdKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMubG9kTGV2ZWxzID0gbGV2ZWxzO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkxPROe6p+WIq+mFjee9ruW3suabtOaWsFwiKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOmHjeaWsOivhOS8sOaJgOacieeyvueBtVxyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxPREZvckFsbFNwcml0ZXMoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDkvJjljJbnibnlrprljLrln5/lhoXnmoTnsr7ngbVcclxuICAgICAqIEBwYXJhbSBjZW50ZXIg5Lit5b+D5L2N572uXHJcbiAgICAgKiBAcGFyYW0gcmFkaXVzIOWNiuW+hFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgb3B0aW1pemVBcmVhKGNlbnRlcjogVmVjMywgcmFkaXVzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBwcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XHJcblxyXG4gICAgICAgIHRoaXMubWFuYWdlZFNwcml0ZXMuZm9yRWFjaCgoc3ByaXRlLCBzcHJpdGVJZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlLm5vZGUgJiYgc3ByaXRlLm5vZGUuaXNWYWxpZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3ByaXRlUG9zID0gc3ByaXRlLm5vZGUud29ybGRQb3NpdGlvbjtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3RhbmNlID0gc3ByaXRlUG9zLnN1YnRyYWN0KGNlbnRlcikubGVuZ3RoKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGRpc3RhbmNlIDw9IHJhZGl1cykge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2godGhpcy5vcHRpbWl6ZVNwcml0ZUxPRChzcHJpdGVJZCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyA9PT09PT09PT09IOengeacieaWueazlSA9PT09PT09PT09XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJ3lp4vljJZMT0TnrqHnkIblmahcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplTE9ETWFuYWdlcigpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLm1hbmFnZWRTcHJpdGVzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wZW5kaW5nVXBkYXRlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMudXBkYXRlUXVldWUgPSBbXTtcclxuICAgICAgICB0aGlzLnVwZGF0ZVRpbWVyID0gMDtcclxuXHJcbiAgICAgICAgLy8g6I635Y+W5Li755u45py6XHJcbiAgICAgICAgdGhpcy5jYW1lcmEgPSBkaXJlY3Rvci5nZXRTY2VuZSgpPy5nZXRDb21wb25lbnRJbkNoaWxkcmVuKENhbWVyYSkgfHwgbnVsbDtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdMT0RNYW5hZ2VyIOWIneWni+WMluWujOaIkFwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa4heeQhkxPROeuoeeQhuWZqFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNsZWFudXBMT0RNYW5hZ2VyKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMubWFuYWdlZFNwcml0ZXMuY2xlYXIoKTtcclxuICAgICAgICB0aGlzLnBlbmRpbmdVcGRhdGVzLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy51cGRhdGVRdWV1ZSA9IFtdO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcIlNWR0xPRE1hbmFnZXIg5riF55CG5a6M5oiQXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog55Sf5oiQ57K+54G1SURcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVNwcml0ZUlkKHNwcml0ZTogU3ByaXRlKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gYCR7c3ByaXRlLm5vZGU/LnV1aWQgfHwgXCJ1bmtub3duXCJ9XyR7c3ByaXRlLnV1aWR9YDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOabtOaWsOaJgOacieeyvueBteeahExPRFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHVwZGF0ZUxPREZvckFsbFNwcml0ZXMoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZUxPRCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLm1hbmFnZWRTcHJpdGVzLmZvckVhY2goKHNwcml0ZSwgc3ByaXRlSWQpID0+IHtcclxuICAgICAgICAgICAgLy8g5qOA5p+l5piv5ZCm6ZyA6KaB5pu05pawXHJcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gRGF0ZS5ub3coKSAvIDEwMDA7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVTaW5jZUxhc3RVcGRhdGUgPSBjdXJyZW50VGltZSAtIHNwcml0ZS5sYXN0VXBkYXRlVGltZTtcclxuICAgICAgICAgICAgY29uc3QgbG9kTGV2ZWwgPSB0aGlzLmxvZExldmVsc1tzcHJpdGUuY3VycmVudExPRExldmVsXTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aW1lU2luY2VMYXN0VXBkYXRlID49IGxvZExldmVsLnVwZGF0ZUludGVydmFsKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBlbmRpbmdVcGRhdGVzLmFkZChzcHJpdGVJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWkhOeQhuW+heabtOaWsOeyvueBtVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHByb2Nlc3NQZW5kaW5nVXBkYXRlcygpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5wZW5kaW5nVXBkYXRlcy5zaXplID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIOWwhuW+heabtOaWsOeyvueBtea3u+WKoOWIsOmYn+WIl1xyXG4gICAgICAgIHRoaXMucGVuZGluZ1VwZGF0ZXMuZm9yRWFjaCgoc3ByaXRlSWQpID0+IHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnVwZGF0ZVF1ZXVlLmluY2x1ZGVzKHNwcml0ZUlkKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVRdWV1ZS5wdXNoKHNwcml0ZUlkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucGVuZGluZ1VwZGF0ZXMuY2xlYXIoKTtcclxuXHJcbiAgICAgICAgLy8g5aSE55CG6Zif5YiX5Lit55qE57K+54G177yI6ZmQ5Yi25bm25Y+R5pWw6YeP77yJXHJcbiAgICAgICAgY29uc3QgY29uY3VycmVudExpbWl0ID0gTWF0aC5taW4odGhpcy5tYXhDb25jdXJyZW50VXBkYXRlcywgdGhpcy51cGRhdGVRdWV1ZS5sZW5ndGgpO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbmN1cnJlbnRMaW1pdDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUlkID0gdGhpcy51cGRhdGVRdWV1ZS5zaGlmdCgpO1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlSWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZXZhbHVhdGVBbmRBcHBseUxPRChzcHJpdGVJZCkuY2F0Y2goY29uc29sZS5lcnJvcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDor4TkvLDlubblupTnlKhMT0RcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhc3luYyBldmFsdWF0ZUFuZEFwcGx5TE9EKHNwcml0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBtYW5hZ2VkU3ByaXRlID0gdGhpcy5tYW5hZ2VkU3ByaXRlcy5nZXQoc3ByaXRlSWQpO1xyXG4gICAgICAgIGlmICghbWFuYWdlZFNwcml0ZSB8fCAhbWFuYWdlZFNwcml0ZS5zcHJpdGUuaXNWYWxpZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyDor4TkvLBMT0TnuqfliKtcclxuICAgICAgICAgICAgY29uc3QgbG9kTGV2ZWxJbmRleCA9IHRoaXMuZXZhbHVhdGVMT0RMZXZlbChtYW5hZ2VkU3ByaXRlKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOWmguaenExPROe6p+WIq+WPkeeUn+WPmOWMlu+8jOW6lOeUqOaWsOeahExPRFxyXG4gICAgICAgICAgICBpZiAobG9kTGV2ZWxJbmRleCAhPT0gbWFuYWdlZFNwcml0ZS5jdXJyZW50TE9ETGV2ZWwpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwbHlMT0RMZXZlbChzcHJpdGVJZCwgbG9kTGV2ZWxJbmRleCk7XHJcbiAgICAgICAgICAgICAgICBtYW5hZ2VkU3ByaXRlLmN1cnJlbnRMT0RMZXZlbCA9IGxvZExldmVsSW5kZXg7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIOabtOaWsOacgOWQjuabtOaWsOaXtumXtFxyXG4gICAgICAgICAgICBtYW5hZ2VkU3ByaXRlLmxhc3RVcGRhdGVUaW1lID0gRGF0ZS5ub3coKSAvIDEwMDA7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihg6K+E5LywTE9E5aSx6LSlICgke3Nwcml0ZUlkfSk6YCwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOivhOS8sExPROe6p+WIq1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGV2YWx1YXRlTE9ETGV2ZWwoc3ByaXRlOiBNYW5hZ2VkU3ByaXRlKTogbnVtYmVyIHtcclxuICAgICAgICBpZiAoIXRoaXMuY2FtZXJhIHx8ICFzcHJpdGUubm9kZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gMDsgLy8g6buY6K6k5pyA6auY57uG6IqCXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDorqHnrpfot53nprtcclxuICAgICAgICBjb25zdCBjYW1lcmFQb3MgPSB0aGlzLmNhbWVyYS5ub2RlPy53b3JsZFBvc2l0aW9uIHx8IG5ldyBWZWMzKDAsIDAsIDApO1xyXG4gICAgICAgIGNvbnN0IHNwcml0ZVBvcyA9IHNwcml0ZS5ub2RlLndvcmxkUG9zaXRpb247XHJcbiAgICAgICAgc3ByaXRlLmRpc3RhbmNlVG9DYW1lcmEgPSBzcHJpdGVQb3Muc3VidHJhY3QoY2FtZXJhUG9zKS5sZW5ndGgoKTtcclxuXHJcbiAgICAgICAgLy8g6K6h566X5bGP5bmV5bC65a+4XHJcbiAgICAgICAgc3ByaXRlLnNjcmVlblNpemUgPSB0aGlzLmNhbGN1bGF0ZVNjcmVlblNpemUoc3ByaXRlKTtcclxuXHJcbiAgICAgICAgLy8g5qOA5p+l5Y+v6KeB5oCnXHJcbiAgICAgICAgc3ByaXRlLmlzVmlzaWJsZSA9IHRoaXMuaXNTcHJpdGVWaXNpYmxlKHNwcml0ZSk7XHJcblxyXG4gICAgICAgIGlmICghc3ByaXRlLmlzVmlzaWJsZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5sb2RMZXZlbHMubGVuZ3RoIC0gMTsgLy8g5LiN5Y+v6KeB5pe25L2/55So5pyA5L2O57uG6IqCXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmoLnmja7ot53nprvlkozlsY/luZXlsLrlr7jnoa7lrppMT0TnuqfliKtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubG9kTGV2ZWxzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5sb2RMZXZlbHNbaV07XHJcblxyXG4gICAgICAgICAgICBpZiAoc3ByaXRlLmRpc3RhbmNlVG9DYW1lcmEgPD0gbGV2ZWwuZGlzdGFuY2VUaHJlc2hvbGQgJiYgc3ByaXRlLnNjcmVlblNpemUgPj0gbGV2ZWwuc2NyZWVuU2l6ZVRocmVzaG9sZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOWmguaenOmDveS4jea7oei2s++8jOi/lOWbnuacgOS9jue7huiKgue6p+WIq1xyXG4gICAgICAgIHJldHVybiB0aGlzLmxvZExldmVscy5sZW5ndGggLSAxO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6h566X5bGP5bmV5bC65a+4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2FsY3VsYXRlU2NyZWVuU2l6ZShzcHJpdGU6IE1hbmFnZWRTcHJpdGUpOiBudW1iZXIge1xyXG4gICAgICAgIGlmICghdGhpcy5jYW1lcmEgfHwgIXNwcml0ZS5ub2RlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzcHJpdGUub3JpZ2luYWxXaWR0aCAqIHNwcml0ZS5vcmlnaW5hbEhlaWdodDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muS9v+eUqOiKgueCueWwuuWvuFxyXG4gICAgICAgIGNvbnN0IHVpVHJhbnNmb3JtID0gc3ByaXRlLm5vZGUuZ2V0Q29tcG9uZW50KFVJVHJhbnNmb3JtKTtcclxuICAgICAgICBpZiAodWlUcmFuc2Zvcm0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVpVHJhbnNmb3JtLndpZHRoICogdWlUcmFuc2Zvcm0uaGVpZ2h0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHNwcml0ZS5vcmlnaW5hbFdpZHRoICogc3ByaXRlLm9yaWdpbmFsSGVpZ2h0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5qOA5p+l57K+54G15piv5ZCm5Y+v6KeBXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgaXNTcHJpdGVWaXNpYmxlKHNwcml0ZTogTWFuYWdlZFNwcml0ZSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghc3ByaXRlLm5vZGUpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya5qOA5p+l6IqC54K55piv5ZCm5r+A5rS75LiU5Zyo5Zy65pmv5LitXHJcbiAgICAgICAgcmV0dXJuIHNwcml0ZS5ub2RlLmFjdGl2ZSAmJiBzcHJpdGUubm9kZS5pc1ZhbGlkO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqU55SoTE9E57qn5YirXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgYXBwbHlMT0RMZXZlbChzcHJpdGVJZDogc3RyaW5nLCBsb2RMZXZlbEluZGV4OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBtYW5hZ2VkU3ByaXRlID0gdGhpcy5tYW5hZ2VkU3ByaXRlcy5nZXQoc3ByaXRlSWQpO1xyXG4gICAgICAgIGlmICghbWFuYWdlZFNwcml0ZSB8fCAhbWFuYWdlZFNwcml0ZS5zcHJpdGUuaXNWYWxpZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBsb2RMZXZlbCA9IHRoaXMubG9kTGV2ZWxzW2xvZExldmVsSW5kZXhdO1xyXG4gICAgICAgIGlmICghbG9kTGV2ZWwpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKGDml6DmlYjnmoRMT0TnuqfliKs6ICR7bG9kTGV2ZWxJbmRleH1gKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g6K6h566X566A5YyW5ZCO55qE5bC65a+4XHJcbiAgICAgICAgICAgIGNvbnN0IHNpbXBsaWZpZWRXaWR0aCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IobWFuYWdlZFNwcml0ZS5vcmlnaW5hbFdpZHRoICogbG9kTGV2ZWwuc2ltcGxpZnlGYWN0b3IpKTtcclxuICAgICAgICAgICAgY29uc3Qgc2ltcGxpZmllZEhlaWdodCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IobWFuYWdlZFNwcml0ZS5vcmlnaW5hbEhlaWdodCAqIGxvZExldmVsLnNpbXBsaWZ5RmFjdG9yKSk7XHJcblxyXG4gICAgICAgICAgICAvLyDojrflj5bnroDljJblkI7nmoRTVkfnsr7ngbXluKdcclxuICAgICAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWUgPSBhd2FpdCBTVkdTcHJpdGVDYWNoZS5nZXRTVkdTcHJpdGVGcmFtZShcclxuICAgICAgICAgICAgICAgIG1hbmFnZWRTcHJpdGUub3JpZ2luYWxTVkdDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgc2ltcGxpZmllZFdpZHRoLFxyXG4gICAgICAgICAgICAgICAgc2ltcGxpZmllZEhlaWdodCxcclxuICAgICAgICAgICAgICAgIG1hbmFnZWRTcHJpdGUub3JpZ2luYWxDb2xvcixcclxuICAgICAgICAgICAgICAgIGxvZExldmVsLnF1YWxpdHlcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChzcHJpdGVGcmFtZSAmJiBtYW5hZ2VkU3ByaXRlLnNwcml0ZS5pc1ZhbGlkKSB7XHJcbiAgICAgICAgICAgICAgICBtYW5hZ2VkU3ByaXRlLnNwcml0ZS5zcHJpdGVGcmFtZSA9IHNwcml0ZUZyYW1lO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBMT0Tmm7TmlrA6ICR7c3ByaXRlSWR9IC0+ICR7bG9kTGV2ZWwubmFtZX0gKCR7c2ltcGxpZmllZFdpZHRofXgke3NpbXBsaWZpZWRIZWlnaHR9KWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihg5bqU55SoTE9E57qn5Yir5aSx6LSlICgke3Nwcml0ZUlkfSk6YCwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS8mOWMlueyvueBtUxPRFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIG9wdGltaXplU3ByaXRlTE9EKHNwcml0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBjb25zdCBtYW5hZ2VkU3ByaXRlID0gdGhpcy5tYW5hZ2VkU3ByaXRlcy5nZXQoc3ByaXRlSWQpO1xyXG4gICAgICAgIGlmICghbWFuYWdlZFNwcml0ZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDph43mlrDor4TkvLBMT0TnuqfliKtcclxuICAgICAgICBjb25zdCBuZXdMb2RMZXZlbCA9IHRoaXMuZXZhbHVhdGVMT0RMZXZlbChtYW5hZ2VkU3ByaXRlKTtcclxuXHJcbiAgICAgICAgLy8g5aaC5p6c5b2T5YmN57qn5Yir5LiN5piv5pyA5LyY77yM5bqU55So5paw55qETE9E57qn5YirXHJcbiAgICAgICAgaWYgKG5ld0xvZExldmVsICE9PSBtYW5hZ2VkU3ByaXRlLmN1cnJlbnRMT0RMZXZlbCkge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcGx5TE9ETGV2ZWwoc3ByaXRlSWQsIG5ld0xvZExldmVsKTtcclxuICAgICAgICAgICAgbWFuYWdlZFNwcml0ZS5jdXJyZW50TE9ETGV2ZWwgPSBuZXdMb2RMZXZlbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmm7TmlrDmgKfog73nu5/orqFcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSB1cGRhdGVQZXJmb3JtYW5jZVN0YXRzKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHN0YXRzID0gdGhpcy5nZXRQZXJmb3JtYW5jZVN0YXRzKCk7XHJcblxyXG4gICAgICAgIC8vIOWumuacn+i+k+WHuuaAp+iDveS/oeaBr1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gRGF0ZS5ub3coKSAvIDEwMDA7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRUaW1lIC0gdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmxhc3RVcGRhdGVUaW1lID49IDUpIHtcclxuICAgICAgICAgICAgLy8g5q+PNeenkui+k+WHuuS4gOasoVxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgTE9E5oCn6IO957uf6K6hOlxyXG4gICAgICAgICAgICAgICAg5oC757K+54G15pWwOiAke3N0YXRzLnRvdGFsU3ByaXRlc31cclxuICAgICAgICAgICAgICAgIOmrmOe7huiKgjogJHtzdGF0cy5oaWdoRGV0YWlsQ291bnR9XHJcbiAgICAgICAgICAgICAgICDkuK3nu4boioI6ICR7c3RhdHMubWVkaXVtRGV0YWlsQ291bnR9XHJcbiAgICAgICAgICAgICAgICDkvY7nu4boioI6ICR7c3RhdHMubG93RGV0YWlsQ291bnR9XHJcbiAgICAgICAgICAgICAgICDmnoHkvY7nu4boioI6ICR7c3RhdHMudmVyeUxvd0RldGFpbENvdW50fVxyXG4gICAgICAgICAgICBgKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5sYXN0VXBkYXRlVGltZSA9IGN1cnJlbnRUaW1lO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=