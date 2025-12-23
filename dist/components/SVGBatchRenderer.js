"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGBatchRenderer = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu } = cc_1._decorator;
const SVGSpriteCache_1 = require("./SVGSpriteCache");
/**
 * SVG批量渲染器
 * 优化大量SVG渲染性能，减少Draw Call
 */
let SVGBatchRenderer = class SVGBatchRenderer extends cc_1.Component {
    constructor() {
        // ========== 批量配置 ==========
        super(...arguments);
        this.enableAutoBatching = true;
        this.batchDistanceThreshold = 50;
        this.maxBatchSize = 20;
        this.enableFrameSplitting = false;
        this.spritesPerFrame = 5;
        // ========== 性能监控 ==========
        this.enablePerformanceMonitoring = false;
        this.monitorInterval = 1.0;
        // ========== 内部状态 ==========
        this.batchedSprites = new Map(); // SVG内容 -> Sprite数组
        this.pendingSprites = []; // 待处理精灵
        this.batchTextures = new Map(); // 批量纹理缓存
        this.frameCounter = 0;
        this.lastMonitorTime = 0;
        this.performanceStats = {
            totalSprites: 0,
            batchCount: 0,
            drawCallReduction: 0,
            averageBatchSize: 0,
            lastFrameTime: 0,
        };
    }
    // ========== 生命周期方法 ==========
    onLoad() {
        this.initializeBatchRenderer();
    }
    onDestroy() {
        this.cleanupBatchRenderer();
    }
    update(deltaTime) {
        if (this.enableAutoBatching) {
            this.processAutoBatching();
        }
        if (this.enableFrameSplitting) {
            this.processFrameSplitting(deltaTime);
        }
        if (this.enablePerformanceMonitoring) {
            this.updatePerformanceMonitoring(deltaTime);
        }
    }
    // ========== 公共方法 ==========
    /**
     * 手动添加精灵到批量渲染
     * @param sprite 精灵组件
     * @param svgContent SVG内容（可选，自动从精灵获取）
     */
    addSpriteToBatch(sprite, svgContent) {
        if (!sprite || !sprite.spriteFrame) {
            console.warn("精灵或精灵帧无效");
            return;
        }
        const content = svgContent || this.extractSVGContentFromSprite(sprite);
        if (!content) {
            console.warn("无法获取SVG内容");
            return;
        }
        if (this.enableAutoBatching) {
            this.pendingSprites.push(sprite);
        }
        else {
            this.addToBatch(content, sprite);
        }
    }
    /**
     * 批量渲染相同SVG的多个实例
     * @param svgContent SVG内容
     * @param sprites 精灵数组
     */
    async batchRenderSameSVG(svgContent, sprites) {
        if (!svgContent || sprites.length === 0)
            return;
        try {
            // 创建批量纹理
            const batchTexture = await this.createBatchTexture(svgContent, sprites);
            if (!batchTexture)
                return;
            // 应用批量纹理到所有精灵
            const spriteFrame = new cc_1.SpriteFrame();
            spriteFrame.texture = batchTexture;
            sprites.forEach((sprite) => {
                if (sprite && sprite.isValid) {
                    sprite.spriteFrame = spriteFrame;
                    this.addToBatch(svgContent, sprite);
                }
            });
            this.performanceStats.batchCount++;
            this.performanceStats.drawCallReduction += sprites.length - 1;
        }
        catch (error) {
            console.error("批量渲染失败:", error);
        }
    }
    /**
     * 执行自动合批
     */
    async performAutoBatching() {
        if (this.pendingSprites.length === 0)
            return;
        // 按SVG内容分组
        const spriteGroups = new Map();
        for (const sprite of this.pendingSprites) {
            if (!sprite.isValid)
                continue;
            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!spriteGroups.has(content)) {
                    spriteGroups.set(content, []);
                }
                spriteGroups.get(content).push(sprite);
            }
        }
        // 批量处理每组
        for (const [content, sprites] of spriteGroups) {
            if (sprites.length > 1) {
                await this.batchRenderSameSVG(content, sprites);
            }
        }
        this.pendingSprites = [];
    }
    /**
     * 清除所有批量数据
     */
    clearAllBatches() {
        this.batchedSprites.clear();
        this.batchTextures.clear();
        this.pendingSprites = [];
        // 释放纹理资源
        this.batchTextures.forEach((texture) => {
            if (texture) {
                texture.destroy();
            }
        });
        this.batchTextures.clear();
        this.performanceStats.batchCount = 0;
        this.performanceStats.drawCallReduction = 0;
    }
    /**
     * 获取性能统计
     */
    getPerformanceStats() {
        const totalBatchedSprites = Array.from(this.batchedSprites.values()).reduce((sum, sprites) => sum + sprites.length, 0);
        this.performanceStats.totalSprites = totalBatchedSprites + this.pendingSprites.length;
        this.performanceStats.averageBatchSize =
            this.performanceStats.batchCount > 0 ? totalBatchedSprites / this.performanceStats.batchCount : 0;
        return Object.assign({}, this.performanceStats);
    }
    /**
     * 优化特定区域内的精灵
     * @param center 中心位置
     * @param radius 半径
     */
    async optimizeArea(center, radius) {
        var _a;
        const camera = (_a = cc_1.director.getScene()) === null || _a === void 0 ? void 0 : _a.getComponentInChildren(cc_1.Camera);
        if (!camera)
            return;
        const spritesInArea = [];
        // 查找区域内的精灵（简化实现）
        // 实际项目中需要更精确的空间查询
        this.batchedSprites.forEach((sprites, content) => {
            sprites.forEach((sprite) => {
                if (sprite.node && sprite.node.isValid) {
                    const spritePos = sprite.node.worldPosition;
                    const distance = spritePos.subtract(center).length();
                    if (distance <= radius) {
                        spritesInArea.push(sprite);
                    }
                }
            });
        });
        if (spritesInArea.length > 1) {
            // 尝试合批区域内的精灵
            await this.optimizeSpriteGroup(spritesInArea);
        }
    }
    // ========== 私有方法 ==========
    /**
     * 初始化批量渲染器
     */
    initializeBatchRenderer() {
        this.batchedSprites.clear();
        this.batchTextures.clear();
        this.pendingSprites = [];
        this.frameCounter = 0;
        this.lastMonitorTime = 0;
        console.log("SVGBatchRenderer 初始化完成");
    }
    /**
     * 清理批量渲染器
     */
    cleanupBatchRenderer() {
        this.clearAllBatches();
        console.log("SVGBatchRenderer 清理完成");
    }
    /**
     * 处理自动合批
     */
    processAutoBatching() {
        if (this.pendingSprites.length >= this.maxBatchSize) {
            this.performAutoBatching().catch(console.error);
        }
    }
    /**
     * 处理分帧渲染
     */
    processFrameSplitting(deltaTime) {
        this.frameCounter++;
        // 每N帧处理一批
        if (this.frameCounter % Math.max(1, Math.floor(60 / this.spritesPerFrame)) === 0) {
            if (this.pendingSprites.length > 0) {
                const batch = this.pendingSprites.splice(0, this.spritesPerFrame);
                this.processSpriteBatch(batch).catch(console.error);
            }
        }
    }
    /**
     * 更新性能监控
     */
    updatePerformanceMonitoring(deltaTime) {
        this.lastMonitorTime += deltaTime;
        if (this.lastMonitorTime >= this.monitorInterval) {
            const stats = this.getPerformanceStats();
            console.log(`SVG批量渲染统计:
                总精灵数: ${stats.totalSprites}
                批次数: ${stats.batchCount}
                Draw Call减少: ${stats.drawCallReduction}
                平均批大小: ${stats.averageBatchSize.toFixed(2)}
            `);
            this.lastMonitorTime = 0;
        }
    }
    /**
     * 从精灵提取SVG内容
     */
    extractSVGContentFromSprite(sprite) {
        // 这里需要根据实际项目结构获取SVG内容
        // 简化实现：返回一个标识符
        if (sprite.node) {
            const spriteComp = sprite.node.getComponent("SVGSprite");
            if (spriteComp && spriteComp.svgContent) {
                return spriteComp.svgContent;
            }
        }
        return null;
    }
    /**
     * 添加到批次
     */
    addToBatch(svgContent, sprite) {
        if (!this.batchedSprites.has(svgContent)) {
            this.batchedSprites.set(svgContent, []);
        }
        const batch = this.batchedSprites.get(svgContent);
        // 使用indexOf替代includes以兼容更低ES版本
        if (batch.indexOf(sprite) === -1) {
            batch.push(sprite);
        }
    }
    /**
     * 创建批量纹理
     */
    async createBatchTexture(svgContent, sprites) {
        const cacheKey = `batch_${svgContent}_${sprites.length}`;
        // 检查缓存
        if (this.batchTextures.has(cacheKey)) {
            return this.batchTextures.get(cacheKey);
        }
        try {
            // 计算批量纹理尺寸
            const batchSize = this.calculateBatchTextureSize(sprites);
            if (batchSize.width === 0 || batchSize.height === 0) {
                return null;
            }
            // 创建Canvas
            const canvas = document.createElement("canvas");
            canvas.width = batchSize.width;
            canvas.height = batchSize.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("无法获取Canvas 2D上下文");
            }
            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 获取单个SVG纹理
            const singleTexture = await SVGSpriteCache_1.SVGSpriteCache.getSimpleSVGSpriteFrame(svgContent, Math.max(...sprites.map((s) => this.getSpriteSize(s).width)));
            if (!singleTexture.texture) {
                throw new Error("无法获取SVG纹理");
            }
            // 绘制所有实例（简化：平铺）
            const cols = Math.ceil(Math.sqrt(sprites.length));
            const rows = Math.ceil(sprites.length / cols);
            const cellWidth = batchSize.width / cols;
            const cellHeight = batchSize.height / rows;
            // 这里应该使用实际的SVG渲染逻辑
            // 简化实现：使用占位符
            ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // 创建纹理
            const imageAsset = new cc_1.ImageAsset(canvas);
            const texture = new cc_1.Texture2D();
            texture.image = imageAsset;
            // 缓存纹理
            this.batchTextures.set(cacheKey, texture);
            return texture;
        }
        catch (error) {
            console.error("创建批量纹理失败:", error);
            return null;
        }
    }
    /**
     * 计算批量纹理尺寸
     */
    calculateBatchTextureSize(sprites) {
        if (sprites.length === 0) {
            return { width: 0, height: 0 };
        }
        // 简单计算：基于精灵数量和平均尺寸
        const totalArea = sprites.reduce((sum, sprite) => {
            const size = this.getSpriteSize(sprite);
            return sum + size.width * size.height;
        }, 0);
        const avgArea = totalArea / sprites.length;
        const spriteCount = sprites.length;
        // 估算纹理尺寸（保持宽高比）
        const estimatedPixels = avgArea * spriteCount * 1.5; // 包含padding
        const side = Math.ceil(Math.sqrt(estimatedPixels));
        return { width: side, height: side };
    }
    /**
     * 获取精灵尺寸
     */
    getSpriteSize(sprite) {
        if (sprite.node) {
            const uiTransform = sprite.node.getComponent(cc_1.UITransform);
            if (uiTransform) {
                return { width: uiTransform.width, height: uiTransform.height };
            }
        }
        if (sprite.spriteFrame) {
            // 对于SVG精灵，使用精灵帧的原始尺寸
            // 或者使用UITransform的尺寸
            return { width: 100, height: 100 }; // 简化：返回默认尺寸
        }
        return { width: 100, height: 100 }; // 默认尺寸
    }
    /**
     * 处理精灵批次
     */
    async processSpriteBatch(sprites) {
        // 按SVG内容分组
        const groups = new Map();
        for (const sprite of sprites) {
            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!groups.has(content)) {
                    groups.set(content, []);
                }
                groups.get(content).push(sprite);
            }
        }
        // 处理每个组
        for (const [content, groupSprites] of groups) {
            if (groupSprites.length > 1) {
                await this.batchRenderSameSVG(content, groupSprites);
            }
        }
    }
    /**
     * 优化精灵组
     */
    async optimizeSpriteGroup(sprites) {
        // 按SVG内容分组
        const groups = new Map();
        for (const sprite of sprites) {
            const content = this.extractSVGContentFromSprite(sprite);
            if (content) {
                if (!groups.has(content)) {
                    groups.set(content, []);
                }
                groups.get(content).push(sprite);
            }
        }
        // 合批每个组
        const promises = [];
        for (const [content, groupSprites] of groups) {
            if (groupSprites.length > 1) {
                promises.push(this.batchRenderSameSVG(content, groupSprites));
            }
        }
        await Promise.all(promises);
    }
    /**
     * 检查精灵是否在视口内
     */
    isSpriteInViewport(sprite, camera) {
        if (!sprite.node || !camera)
            return false;
        // 简化实现：检查节点是否激活
        return sprite.node.active;
    }
};
exports.SVGBatchRenderer = SVGBatchRenderer;
__decorate([
    property({
        tooltip: "启用自动合批",
        displayName: "自动合批",
    })
], SVGBatchRenderer.prototype, "enableAutoBatching", void 0);
__decorate([
    property({
        tooltip: "合批距离阈值（像素）",
        displayName: "合批距离",
        min: 0,
    })
], SVGBatchRenderer.prototype, "batchDistanceThreshold", void 0);
__decorate([
    property({
        tooltip: "最大每批数量",
        displayName: "每批最大数",
        min: 1,
        max: 100,
    })
], SVGBatchRenderer.prototype, "maxBatchSize", void 0);
__decorate([
    property({
        tooltip: "启用分帧渲染",
        displayName: "分帧渲染",
    })
], SVGBatchRenderer.prototype, "enableFrameSplitting", void 0);
__decorate([
    property({
        tooltip: "每帧渲染数量",
        displayName: "每帧数量",
        min: 1,
        visible: function () {
            return this.enableFrameSplitting;
        },
    })
], SVGBatchRenderer.prototype, "spritesPerFrame", void 0);
__decorate([
    property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
], SVGBatchRenderer.prototype, "enablePerformanceMonitoring", void 0);
__decorate([
    property({
        tooltip: "监控更新间隔（秒）",
        displayName: "监控间隔",
        min: 0.1,
        max: 5,
        visible: function () {
            return this.enablePerformanceMonitoring;
        },
    })
], SVGBatchRenderer.prototype, "monitorInterval", void 0);
exports.SVGBatchRenderer = SVGBatchRenderer = __decorate([
    ccclass("SVGBatchRenderer"),
    menu("2D/SVGBatchRenderer"),
    executeInEditMode
], SVGBatchRenderer);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQmF0Y2hSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS9jb21wb25lbnRzL1NWR0JhdGNoUmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsMkJBQTRIO0FBQzVILE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxHQUFHLGVBQVUsQ0FBQztBQUVsRSxxREFBa0Q7QUFFbEQ7OztHQUdHO0FBSUksSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBaUIsU0FBUSxjQUFTO0lBQXhDO1FBQ0gsNkJBQTZCOztRQU1yQix1QkFBa0IsR0FBWSxJQUFJLENBQUM7UUFPbkMsMkJBQXNCLEdBQVcsRUFBRSxDQUFDO1FBUXBDLGlCQUFZLEdBQVcsRUFBRSxDQUFDO1FBTTFCLHlCQUFvQixHQUFZLEtBQUssQ0FBQztRQVV0QyxvQkFBZSxHQUFXLENBQUMsQ0FBQztRQUVwQyw2QkFBNkI7UUFNckIsZ0NBQTJCLEdBQVksS0FBSyxDQUFDO1FBVzdDLG9CQUFlLEdBQVcsR0FBRyxDQUFDO1FBRXRDLDZCQUE2QjtRQUVyQixtQkFBYyxHQUEwQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsb0JBQW9CO1FBQ3ZFLG1CQUFjLEdBQWEsRUFBRSxDQUFDLENBQUMsUUFBUTtRQUN2QyxrQkFBYSxHQUEyQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUztRQUM1RCxpQkFBWSxHQUFXLENBQUMsQ0FBQztRQUN6QixvQkFBZSxHQUFXLENBQUMsQ0FBQztRQUU1QixxQkFBZ0IsR0FBRztZQUN2QixZQUFZLEVBQUUsQ0FBQztZQUNmLFVBQVUsRUFBRSxDQUFDO1lBQ2IsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixnQkFBZ0IsRUFBRSxDQUFDO1lBQ25CLGFBQWEsRUFBRSxDQUFDO1NBQ25CLENBQUM7SUFpY04sQ0FBQztJQS9iRywrQkFBK0I7SUFFL0IsTUFB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QUFDO0tBQ0osQ0FBQzt5REFDb0M7MkJBekQ3QixnQkFBZ0I7SUFINUIsT0FBTyxDQUFDLGtCQUFrQixDQUFDO0lBQzNCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztJQUMzQixpQkFBaUI7R0FDTCxnQkFBZ0IsQ0EwZ0I1QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IF9kZWNvcmF0b3IsIENvbXBvbmVudCwgU3ByaXRlLCBTcHJpdGVGcmFtZSwgVGV4dHVyZTJELCBJbWFnZUFzc2V0LCBWZWMzLCBkaXJlY3RvciwgQ2FtZXJhLCBVSVRyYW5zZm9ybSB9IGZyb20gXCJjY1wiO1xuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUgfSA9IF9kZWNvcmF0b3I7XG5cbmltcG9ydCB7IFNWR1Nwcml0ZUNhY2hlIH0gZnJvbSBcIi4vU1ZHU3ByaXRlQ2FjaGVcIjtcblxuLyoqXG4gKiBTVkfmibnph4/muLLmn5PlmahcbiAqIOS8mOWMluWkp+mHj1NWR+a4suafk+aAp+iDve+8jOWHj+WwkURyYXcgQ2FsbFxuICovXG5AY2NjbGFzcyhcIlNWR0JhdGNoUmVuZGVyZXJcIilcbkBtZW51KFwiMkQvU1ZHQmF0Y2hSZW5kZXJlclwiKVxuQGV4ZWN1dGVJbkVkaXRNb2RlXG5leHBvcnQgY2xhc3MgU1ZHQmF0Y2hSZW5kZXJlciBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLy8gPT09PT09PT09PSDmibnph4/phY3nva4gPT09PT09PT09PVxuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjoh6rliqjlkIjmiblcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi6Ieq5Yqo5ZCI5om5XCIsXG4gICAgfSlcbiAgICBwcml2YXRlIGVuYWJsZUF1dG9CYXRjaGluZzogYm9vbGVhbiA9IHRydWU7XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuWQiOaJuei3neemu+mYiOWAvO+8iOWDj+e0oO+8iVwiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLlkIjmibnot53nprtcIixcbiAgICAgICAgbWluOiAwLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBiYXRjaERpc3RhbmNlVGhyZXNob2xkOiBudW1iZXIgPSA1MDtcblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi5pyA5aSn5q+P5om55pWw6YePXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuavj+aJueacgOWkp+aVsFwiLFxuICAgICAgICBtaW46IDEsXG4gICAgICAgIG1heDogMTAwLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBtYXhCYXRjaFNpemU6IG51bWJlciA9IDIwO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjliIbluKfmuLLmn5NcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5YiG5bin5riy5p+TXCIsXG4gICAgfSlcbiAgICBwcml2YXRlIGVuYWJsZUZyYW1lU3BsaXR0aW5nOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuavj+W4p+a4suafk+aVsOmHj1wiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmr4/luKfmlbDph49cIixcbiAgICAgICAgbWluOiAxLFxuICAgICAgICB2aXNpYmxlOiBmdW5jdGlvbiAodGhpczogU1ZHQmF0Y2hSZW5kZXJlcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW5hYmxlRnJhbWVTcGxpdHRpbmc7XG4gICAgICAgIH0sXG4gICAgfSlcbiAgICBwcml2YXRlIHNwcml0ZXNQZXJGcmFtZTogbnVtYmVyID0gNTtcblxuICAgIC8vID09PT09PT09PT0g5oCn6IO955uR5o6nID09PT09PT09PT1cblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So5oCn6IO955uR5o6nXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuaAp+iDveebkeaOp1wiLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBlbmFibGVQZXJmb3JtYW5jZU1vbml0b3Jpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi55uR5o6n5pu05paw6Ze06ZqU77yI56eS77yJXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuebkeaOp+mXtOmalFwiLFxuICAgICAgICBtaW46IDAuMSxcbiAgICAgICAgbWF4OiA1LFxuICAgICAgICB2aXNpYmxlOiBmdW5jdGlvbiAodGhpczogU1ZHQmF0Y2hSZW5kZXJlcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW5hYmxlUGVyZm9ybWFuY2VNb25pdG9yaW5nO1xuICAgICAgICB9LFxuICAgIH0pXG4gICAgcHJpdmF0ZSBtb25pdG9ySW50ZXJ2YWw6IG51bWJlciA9IDEuMDtcblxuICAgIC8vID09PT09PT09PT0g5YaF6YOo54q25oCBID09PT09PT09PT1cblxuICAgIHByaXZhdGUgYmF0Y2hlZFNwcml0ZXM6IE1hcDxzdHJpbmcsIFNwcml0ZVtdPiA9IG5ldyBNYXAoKTsgLy8gU1ZH5YaF5a65IC0+IFNwcml0ZeaVsOe7hFxuICAgIHByaXZhdGUgcGVuZGluZ1Nwcml0ZXM6IFNwcml0ZVtdID0gW107IC8vIOW+heWkhOeQhueyvueBtVxuICAgIHByaXZhdGUgYmF0Y2hUZXh0dXJlczogTWFwPHN0cmluZywgVGV4dHVyZTJEPiA9IG5ldyBNYXAoKTsgLy8g5om56YeP57q555CG57yT5a2YXG4gICAgcHJpdmF0ZSBmcmFtZUNvdW50ZXI6IG51bWJlciA9IDA7XG4gICAgcHJpdmF0ZSBsYXN0TW9uaXRvclRpbWU6IG51bWJlciA9IDA7XG5cbiAgICBwcml2YXRlIHBlcmZvcm1hbmNlU3RhdHMgPSB7XG4gICAgICAgIHRvdGFsU3ByaXRlczogMCxcbiAgICAgICAgYmF0Y2hDb3VudDogMCxcbiAgICAgICAgZHJhd0NhbGxSZWR1Y3Rpb246IDAsXG4gICAgICAgIGF2ZXJhZ2VCYXRjaFNpemU6IDAsXG4gICAgICAgIGxhc3RGcmFtZVRpbWU6IDAsXG4gICAgfTtcblxuICAgIC8vID09PT09PT09PT0g55Sf5ZG95ZGo5pyf5pa55rOVID09PT09PT09PT1cblxuICAgIG9uTG9hZCgpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQmF0Y2hSZW5kZXJlcigpO1xuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5jbGVhbnVwQmF0Y2hSZW5kZXJlcigpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkZWx0YVRpbWU6IG51bWJlcikge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVBdXRvQmF0Y2hpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc0F1dG9CYXRjaGluZygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlRnJhbWVTcGxpdHRpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc0ZyYW1lU3BsaXR0aW5nKGRlbHRhVGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVQZXJmb3JtYW5jZU1vbml0b3JpbmcpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUGVyZm9ybWFuY2VNb25pdG9yaW5nKGRlbHRhVGltZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09IOWFrOWFseaWueazlSA9PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDmiYvliqjmt7vliqDnsr7ngbXliLDmibnph4/muLLmn5NcbiAgICAgKiBAcGFyYW0gc3ByaXRlIOeyvueBtee7hOS7tlxuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuue+8iOWPr+mAie+8jOiHquWKqOS7jueyvueBteiOt+WPlu+8iVxuICAgICAqL1xuICAgIHB1YmxpYyBhZGRTcHJpdGVUb0JhdGNoKHNwcml0ZTogU3ByaXRlLCBzdmdDb250ZW50Pzogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmICghc3ByaXRlIHx8ICFzcHJpdGUuc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIueyvueBteaIlueyvueBteW4p+aXoOaViFwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBzdmdDb250ZW50IHx8IHRoaXMuZXh0cmFjdFNWR0NvbnRlbnRGcm9tU3ByaXRlKHNwcml0ZSk7XG4gICAgICAgIGlmICghY29udGVudCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwi5peg5rOV6I635Y+WU1ZH5YaF5a65XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQXV0b0JhdGNoaW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBlbmRpbmdTcHJpdGVzLnB1c2goc3ByaXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9CYXRjaChjb250ZW50LCBzcHJpdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5om56YeP5riy5p+T55u45ZCMU1ZH55qE5aSa5Liq5a6e5L6LXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a65XG4gICAgICogQHBhcmFtIHNwcml0ZXMg57K+54G15pWw57uEXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGJhdGNoUmVuZGVyU2FtZVNWRyhzdmdDb250ZW50OiBzdHJpbmcsIHNwcml0ZXM6IFNwcml0ZVtdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghc3ZnQ29udGVudCB8fCBzcHJpdGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDliJvlu7rmibnph4/nurnnkIZcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoVGV4dHVyZSA9IGF3YWl0IHRoaXMuY3JlYXRlQmF0Y2hUZXh0dXJlKHN2Z0NvbnRlbnQsIHNwcml0ZXMpO1xuICAgICAgICAgICAgaWYgKCFiYXRjaFRleHR1cmUpIHJldHVybjtcblxuICAgICAgICAgICAgLy8g5bqU55So5om56YeP57q555CG5Yiw5omA5pyJ57K+54G1XG4gICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IG5ldyBTcHJpdGVGcmFtZSgpO1xuICAgICAgICAgICAgc3ByaXRlRnJhbWUudGV4dHVyZSA9IGJhdGNoVGV4dHVyZTtcblxuICAgICAgICAgICAgc3ByaXRlcy5mb3JFYWNoKChzcHJpdGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc3ByaXRlICYmIHNwcml0ZS5pc1ZhbGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwcml0ZS5zcHJpdGVGcmFtZSA9IHNwcml0ZUZyYW1lO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFRvQmF0Y2goc3ZnQ29udGVudCwgc3ByaXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmJhdGNoQ291bnQrKztcbiAgICAgICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5kcmF3Q2FsbFJlZHVjdGlvbiArPSBzcHJpdGVzLmxlbmd0aCAtIDE7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi5om56YeP5riy5p+T5aSx6LSlOlwiLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmiafooYzoh6rliqjlkIjmiblcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgcGVyZm9ybUF1dG9CYXRjaGluZygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMucGVuZGluZ1Nwcml0ZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICAgICAgLy8g5oyJU1ZH5YaF5a655YiG57uEXG4gICAgICAgIGNvbnN0IHNwcml0ZUdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBTcHJpdGVbXT4oKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHNwcml0ZSBvZiB0aGlzLnBlbmRpbmdTcHJpdGVzKSB7XG4gICAgICAgICAgICBpZiAoIXNwcml0ZS5pc1ZhbGlkKSBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHRoaXMuZXh0cmFjdFNWR0NvbnRlbnRGcm9tU3ByaXRlKHNwcml0ZSk7XG4gICAgICAgICAgICBpZiAoY29udGVudCkge1xuICAgICAgICAgICAgICAgIGlmICghc3ByaXRlR3JvdXBzLmhhcyhjb250ZW50KSkge1xuICAgICAgICAgICAgICAgICAgICBzcHJpdGVHcm91cHMuc2V0KGNvbnRlbnQsIFtdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3ByaXRlR3JvdXBzLmdldChjb250ZW50KSEucHVzaChzcHJpdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8g5om56YeP5aSE55CG5q+P57uEXG4gICAgICAgIGZvciAoY29uc3QgW2NvbnRlbnQsIHNwcml0ZXNdIG9mIHNwcml0ZUdyb3Vwcykge1xuICAgICAgICAgICAgaWYgKHNwcml0ZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYmF0Y2hSZW5kZXJTYW1lU1ZHKGNvbnRlbnQsIHNwcml0ZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wZW5kaW5nU3ByaXRlcyA9IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOa4hemZpOaJgOacieaJuemHj+aVsOaNrlxuICAgICAqL1xuICAgIHB1YmxpYyBjbGVhckFsbEJhdGNoZXMoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYmF0Y2hlZFNwcml0ZXMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5iYXRjaFRleHR1cmVzLmNsZWFyKCk7XG4gICAgICAgIHRoaXMucGVuZGluZ1Nwcml0ZXMgPSBbXTtcblxuICAgICAgICAvLyDph4rmlL7nurnnkIbotYTmupBcbiAgICAgICAgdGhpcy5iYXRjaFRleHR1cmVzLmZvckVhY2goKHRleHR1cmUpID0+IHtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmF0Y2hUZXh0dXJlcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuYmF0Y2hDb3VudCA9IDA7XG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5kcmF3Q2FsbFJlZHVjdGlvbiA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6I635Y+W5oCn6IO957uf6K6hXG4gICAgICovXG4gICAgcHVibGljIGdldFBlcmZvcm1hbmNlU3RhdHMoKTogdHlwZW9mIHRoaXMucGVyZm9ybWFuY2VTdGF0cyB7XG4gICAgICAgIGNvbnN0IHRvdGFsQmF0Y2hlZFNwcml0ZXMgPSBBcnJheS5mcm9tKHRoaXMuYmF0Y2hlZFNwcml0ZXMudmFsdWVzKCkpLnJlZHVjZSgoc3VtLCBzcHJpdGVzKSA9PiBzdW0gKyBzcHJpdGVzLmxlbmd0aCwgMCk7XG5cbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLnRvdGFsU3ByaXRlcyA9IHRvdGFsQmF0Y2hlZFNwcml0ZXMgKyB0aGlzLnBlbmRpbmdTcHJpdGVzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmF2ZXJhZ2VCYXRjaFNpemUgPVxuICAgICAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmJhdGNoQ291bnQgPiAwID8gdG90YWxCYXRjaGVkU3ByaXRlcyAvIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5iYXRjaENvdW50IDogMDtcblxuICAgICAgICByZXR1cm4geyAuLi50aGlzLnBlcmZvcm1hbmNlU3RhdHMgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDkvJjljJbnibnlrprljLrln5/lhoXnmoTnsr7ngbVcbiAgICAgKiBAcGFyYW0gY2VudGVyIOS4reW/g+S9jee9rlxuICAgICAqIEBwYXJhbSByYWRpdXMg5Y2K5b6EXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIG9wdGltaXplQXJlYShjZW50ZXI6IFZlYzMsIHJhZGl1czogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGRpcmVjdG9yLmdldFNjZW5lKCk/LmdldENvbXBvbmVudEluQ2hpbGRyZW4oQ2FtZXJhKTtcbiAgICAgICAgaWYgKCFjYW1lcmEpIHJldHVybjtcblxuICAgICAgICBjb25zdCBzcHJpdGVzSW5BcmVhOiBTcHJpdGVbXSA9IFtdO1xuXG4gICAgICAgIC8vIOafpeaJvuWMuuWfn+WGheeahOeyvueBte+8iOeugOWMluWunueOsO+8iVxuICAgICAgICAvLyDlrp7pmYXpobnnm67kuK3pnIDopoHmm7Tnsr7noa7nmoTnqbrpl7Tmn6Xor6JcbiAgICAgICAgdGhpcy5iYXRjaGVkU3ByaXRlcy5mb3JFYWNoKChzcHJpdGVzLCBjb250ZW50KSA9PiB7XG4gICAgICAgICAgICBzcHJpdGVzLmZvckVhY2goKHNwcml0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChzcHJpdGUubm9kZSAmJiBzcHJpdGUubm9kZS5pc1ZhbGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwcml0ZVBvcyA9IHNwcml0ZS5ub2RlLndvcmxkUG9zaXRpb247XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3RhbmNlID0gc3ByaXRlUG9zLnN1YnRyYWN0KGNlbnRlcikubGVuZ3RoKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRpc3RhbmNlIDw9IHJhZGl1cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3ByaXRlc0luQXJlYS5wdXNoKHNwcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHNwcml0ZXNJbkFyZWEubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgLy8g5bCd6K+V5ZCI5om55Yy65Z+f5YaF55qE57K+54G1XG4gICAgICAgICAgICBhd2FpdCB0aGlzLm9wdGltaXplU3ByaXRlR3JvdXAoc3ByaXRlc0luQXJlYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09IOengeacieaWueazlSA9PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDliJ3lp4vljJbmibnph4/muLLmn5PlmahcbiAgICAgKi9cbiAgICBwcml2YXRlIGluaXRpYWxpemVCYXRjaFJlbmRlcmVyKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmJhdGNoZWRTcHJpdGVzLmNsZWFyKCk7XG4gICAgICAgIHRoaXMuYmF0Y2hUZXh0dXJlcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnBlbmRpbmdTcHJpdGVzID0gW107XG4gICAgICAgIHRoaXMuZnJhbWVDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5sYXN0TW9uaXRvclRpbWUgPSAwO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1ZHQmF0Y2hSZW5kZXJlciDliJ3lp4vljJblrozmiJBcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5riF55CG5om56YeP5riy5p+T5ZmoXG4gICAgICovXG4gICAgcHJpdmF0ZSBjbGVhbnVwQmF0Y2hSZW5kZXJlcigpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jbGVhckFsbEJhdGNoZXMoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdCYXRjaFJlbmRlcmVyIOa4heeQhuWujOaIkFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDlpITnkIboh6rliqjlkIjmiblcbiAgICAgKi9cbiAgICBwcml2YXRlIHByb2Nlc3NBdXRvQmF0Y2hpbmcoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnBlbmRpbmdTcHJpdGVzLmxlbmd0aCA+PSB0aGlzLm1heEJhdGNoU2l6ZSkge1xuICAgICAgICAgICAgdGhpcy5wZXJmb3JtQXV0b0JhdGNoaW5nKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDlpITnkIbliIbluKfmuLLmn5NcbiAgICAgKi9cbiAgICBwcml2YXRlIHByb2Nlc3NGcmFtZVNwbGl0dGluZyhkZWx0YVRpbWU6IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLmZyYW1lQ291bnRlcisrO1xuXG4gICAgICAgIC8vIOavj07luKflpITnkIbkuIDmiblcbiAgICAgICAgaWYgKHRoaXMuZnJhbWVDb3VudGVyICUgTWF0aC5tYXgoMSwgTWF0aC5mbG9vcig2MCAvIHRoaXMuc3ByaXRlc1BlckZyYW1lKSkgPT09IDApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBlbmRpbmdTcHJpdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMucGVuZGluZ1Nwcml0ZXMuc3BsaWNlKDAsIHRoaXMuc3ByaXRlc1BlckZyYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NTcHJpdGVCYXRjaChiYXRjaCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmm7TmlrDmgKfog73nm5HmjqdcbiAgICAgKi9cbiAgICBwcml2YXRlIHVwZGF0ZVBlcmZvcm1hbmNlTW9uaXRvcmluZyhkZWx0YVRpbWU6IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLmxhc3RNb25pdG9yVGltZSArPSBkZWx0YVRpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMubGFzdE1vbml0b3JUaW1lID49IHRoaXMubW9uaXRvckludGVydmFsKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IHRoaXMuZ2V0UGVyZm9ybWFuY2VTdGF0cygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFNWR+aJuemHj+a4suafk+e7n+iuoTpcbiAgICAgICAgICAgICAgICDmgLvnsr7ngbXmlbA6ICR7c3RhdHMudG90YWxTcHJpdGVzfVxuICAgICAgICAgICAgICAgIOaJueasoeaVsDogJHtzdGF0cy5iYXRjaENvdW50fVxuICAgICAgICAgICAgICAgIERyYXcgQ2FsbOWHj+WwkTogJHtzdGF0cy5kcmF3Q2FsbFJlZHVjdGlvbn1cbiAgICAgICAgICAgICAgICDlubPlnYfmibnlpKflsI86ICR7c3RhdHMuYXZlcmFnZUJhdGNoU2l6ZS50b0ZpeGVkKDIpfVxuICAgICAgICAgICAgYCk7XG5cbiAgICAgICAgICAgIHRoaXMubGFzdE1vbml0b3JUaW1lID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOS7jueyvueBteaPkOWPllNWR+WGheWuuVxuICAgICAqL1xuICAgIHByaXZhdGUgZXh0cmFjdFNWR0NvbnRlbnRGcm9tU3ByaXRlKHNwcml0ZTogU3ByaXRlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIC8vIOi/memHjOmcgOimgeagueaNruWunumZhemhueebrue7k+aehOiOt+WPllNWR+WGheWuuVxuICAgICAgICAvLyDnroDljJblrp7njrDvvJrov5Tlm57kuIDkuKrmoIfor4bnrKZcbiAgICAgICAgaWYgKHNwcml0ZS5ub2RlKSB7XG4gICAgICAgICAgICBjb25zdCBzcHJpdGVDb21wID0gc3ByaXRlLm5vZGUuZ2V0Q29tcG9uZW50KFwiU1ZHU3ByaXRlXCIpO1xuICAgICAgICAgICAgaWYgKHNwcml0ZUNvbXAgJiYgKHNwcml0ZUNvbXAgYXMgYW55KS5zdmdDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChzcHJpdGVDb21wIGFzIGFueSkuc3ZnQ29udGVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmt7vliqDliLDmibnmrKFcbiAgICAgKi9cbiAgICBwcml2YXRlIGFkZFRvQmF0Y2goc3ZnQ29udGVudDogc3RyaW5nLCBzcHJpdGU6IFNwcml0ZSk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuYmF0Y2hlZFNwcml0ZXMuaGFzKHN2Z0NvbnRlbnQpKSB7XG4gICAgICAgICAgICB0aGlzLmJhdGNoZWRTcHJpdGVzLnNldChzdmdDb250ZW50LCBbXSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuYmF0Y2hlZFNwcml0ZXMuZ2V0KHN2Z0NvbnRlbnQpITtcbiAgICAgICAgLy8g5L2/55SoaW5kZXhPZuabv+S7o2luY2x1ZGVz5Lul5YW85a655pu05L2ORVPniYjmnKxcbiAgICAgICAgaWYgKGJhdGNoLmluZGV4T2Yoc3ByaXRlKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIGJhdGNoLnB1c2goc3ByaXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOWIm+W7uuaJuemHj+e6ueeQhlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQmF0Y2hUZXh0dXJlKHN2Z0NvbnRlbnQ6IHN0cmluZywgc3ByaXRlczogU3ByaXRlW10pOiBQcm9taXNlPFRleHR1cmUyRCB8IG51bGw+IHtcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgYmF0Y2hfJHtzdmdDb250ZW50fV8ke3Nwcml0ZXMubGVuZ3RofWA7XG5cbiAgICAgICAgLy8g5qOA5p+l57yT5a2YXG4gICAgICAgIGlmICh0aGlzLmJhdGNoVGV4dHVyZXMuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYmF0Y2hUZXh0dXJlcy5nZXQoY2FjaGVLZXkpITtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDorqHnrpfmibnph4/nurnnkIblsLrlr7hcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoU2l6ZSA9IHRoaXMuY2FsY3VsYXRlQmF0Y2hUZXh0dXJlU2l6ZShzcHJpdGVzKTtcbiAgICAgICAgICAgIGlmIChiYXRjaFNpemUud2lkdGggPT09IDAgfHwgYmF0Y2hTaXplLmhlaWdodCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDliJvlu7pDYW52YXNcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XG4gICAgICAgICAgICBjYW52YXMud2lkdGggPSBiYXRjaFNpemUud2lkdGg7XG4gICAgICAgICAgICBjYW52YXMuaGVpZ2h0ID0gYmF0Y2hTaXplLmhlaWdodDtcblxuICAgICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICAgICAgICAgIGlmICghY3R4KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+WQ2FudmFzIDJE5LiK5LiL5paHXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDmuIXnqbrnlLvluINcbiAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8g6I635Y+W5Y2V5LiqU1ZH57q555CGXG4gICAgICAgICAgICBjb25zdCBzaW5nbGVUZXh0dXJlID0gYXdhaXQgU1ZHU3ByaXRlQ2FjaGUuZ2V0U2ltcGxlU1ZHU3ByaXRlRnJhbWUoXG4gICAgICAgICAgICAgICAgc3ZnQ29udGVudCxcbiAgICAgICAgICAgICAgICBNYXRoLm1heCguLi5zcHJpdGVzLm1hcCgocykgPT4gdGhpcy5nZXRTcHJpdGVTaXplKHMpLndpZHRoKSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICghc2luZ2xlVGV4dHVyZS50ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+WU1ZH57q555CGXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDnu5jliLbmiYDmnInlrp7kvovvvIjnroDljJbvvJrlubPpk7rvvIlcbiAgICAgICAgICAgIGNvbnN0IGNvbHMgPSBNYXRoLmNlaWwoTWF0aC5zcXJ0KHNwcml0ZXMubGVuZ3RoKSk7XG4gICAgICAgICAgICBjb25zdCByb3dzID0gTWF0aC5jZWlsKHNwcml0ZXMubGVuZ3RoIC8gY29scyk7XG4gICAgICAgICAgICBjb25zdCBjZWxsV2lkdGggPSBiYXRjaFNpemUud2lkdGggLyBjb2xzO1xuICAgICAgICAgICAgY29uc3QgY2VsbEhlaWdodCA9IGJhdGNoU2l6ZS5oZWlnaHQgLyByb3dzO1xuXG4gICAgICAgICAgICAvLyDov5nph4zlupTor6Xkvb/nlKjlrp7pmYXnmoRTVkfmuLLmn5PpgLvovpFcbiAgICAgICAgICAgIC8vIOeugOWMluWunueOsO+8muS9v+eUqOWNoOS9jeesplxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmdiYSgwLCAwLCAwLCAwLjEpXCI7XG4gICAgICAgICAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8g5Yib5bu657q555CGXG4gICAgICAgICAgICBjb25zdCBpbWFnZUFzc2V0ID0gbmV3IEltYWdlQXNzZXQoY2FudmFzKTtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZTJEKCk7XG4gICAgICAgICAgICB0ZXh0dXJlLmltYWdlID0gaW1hZ2VBc3NldDtcblxuICAgICAgICAgICAgLy8g57yT5a2Y57q555CGXG4gICAgICAgICAgICB0aGlzLmJhdGNoVGV4dHVyZXMuc2V0KGNhY2hlS2V5LCB0ZXh0dXJlKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi5Yib5bu65om56YeP57q555CG5aSx6LSlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuoeeul+aJuemHj+e6ueeQhuWwuuWvuFxuICAgICAqL1xuICAgIHByaXZhdGUgY2FsY3VsYXRlQmF0Y2hUZXh0dXJlU2l6ZShzcHJpdGVzOiBTcHJpdGVbXSk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XG4gICAgICAgIGlmIChzcHJpdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g566A5Y2V6K6h566X77ya5Z+65LqO57K+54G15pWw6YeP5ZKM5bmz5Z2H5bC65a+4XG4gICAgICAgIGNvbnN0IHRvdGFsQXJlYSA9IHNwcml0ZXMucmVkdWNlKChzdW0sIHNwcml0ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHRoaXMuZ2V0U3ByaXRlU2l6ZShzcHJpdGUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1bSArIHNpemUud2lkdGggKiBzaXplLmhlaWdodDtcbiAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgY29uc3QgYXZnQXJlYSA9IHRvdGFsQXJlYSAvIHNwcml0ZXMubGVuZ3RoO1xuICAgICAgICBjb25zdCBzcHJpdGVDb3VudCA9IHNwcml0ZXMubGVuZ3RoO1xuXG4gICAgICAgIC8vIOS8sOeul+e6ueeQhuWwuuWvuO+8iOS/neaMgeWuvemrmOavlO+8iVxuICAgICAgICBjb25zdCBlc3RpbWF0ZWRQaXhlbHMgPSBhdmdBcmVhICogc3ByaXRlQ291bnQgKiAxLjU7IC8vIOWMheWQq3BhZGRpbmdcbiAgICAgICAgY29uc3Qgc2lkZSA9IE1hdGguY2VpbChNYXRoLnNxcnQoZXN0aW1hdGVkUGl4ZWxzKSk7XG5cbiAgICAgICAgcmV0dXJuIHsgd2lkdGg6IHNpZGUsIGhlaWdodDogc2lkZSB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPlueyvueBteWwuuWvuFxuICAgICAqL1xuICAgIHByaXZhdGUgZ2V0U3ByaXRlU2l6ZShzcHJpdGU6IFNwcml0ZSk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XG4gICAgICAgIGlmIChzcHJpdGUubm9kZSkge1xuICAgICAgICAgICAgY29uc3QgdWlUcmFuc2Zvcm0gPSBzcHJpdGUubm9kZS5nZXRDb21wb25lbnQoVUlUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgaWYgKHVpVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgd2lkdGg6IHVpVHJhbnNmb3JtLndpZHRoLCBoZWlnaHQ6IHVpVHJhbnNmb3JtLmhlaWdodCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwcml0ZS5zcHJpdGVGcmFtZSkge1xuICAgICAgICAgICAgLy8g5a+55LqOU1ZH57K+54G177yM5L2/55So57K+54G15bin55qE5Y6f5aeL5bC65a+4XG4gICAgICAgICAgICAvLyDmiJbogIXkvb/nlKhVSVRyYW5zZm9ybeeahOWwuuWvuFxuICAgICAgICAgICAgcmV0dXJuIHsgd2lkdGg6IDEwMCwgaGVpZ2h0OiAxMDAgfTsgLy8g566A5YyW77ya6L+U5Zue6buY6K6k5bC65a+4XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyB3aWR0aDogMTAwLCBoZWlnaHQ6IDEwMCB9OyAvLyDpu5jorqTlsLrlr7hcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDlpITnkIbnsr7ngbXmibnmrKFcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHByb2Nlc3NTcHJpdGVCYXRjaChzcHJpdGVzOiBTcHJpdGVbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyDmjIlTVkflhoXlrrnliIbnu4RcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIFNwcml0ZVtdPigpO1xuXG4gICAgICAgIGZvciAoY29uc3Qgc3ByaXRlIG9mIHNwcml0ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmV4dHJhY3RTVkdDb250ZW50RnJvbVNwcml0ZShzcHJpdGUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWdyb3Vwcy5oYXMoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXBzLnNldChjb250ZW50LCBbXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdyb3Vwcy5nZXQoY29udGVudCkhLnB1c2goc3ByaXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWkhOeQhuavj+S4que7hFxuICAgICAgICBmb3IgKGNvbnN0IFtjb250ZW50LCBncm91cFNwcml0ZXNdIG9mIGdyb3Vwcykge1xuICAgICAgICAgICAgaWYgKGdyb3VwU3ByaXRlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5iYXRjaFJlbmRlclNhbWVTVkcoY29udGVudCwgZ3JvdXBTcHJpdGVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOS8mOWMlueyvueBtee7hFxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgb3B0aW1pemVTcHJpdGVHcm91cChzcHJpdGVzOiBTcHJpdGVbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyDmjIlTVkflhoXlrrnliIbnu4RcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIFNwcml0ZVtdPigpO1xuXG4gICAgICAgIGZvciAoY29uc3Qgc3ByaXRlIG9mIHNwcml0ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmV4dHJhY3RTVkdDb250ZW50RnJvbVNwcml0ZShzcHJpdGUpO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWdyb3Vwcy5oYXMoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXBzLnNldChjb250ZW50LCBbXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdyb3Vwcy5nZXQoY29udGVudCkhLnB1c2goc3ByaXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWQiOaJueavj+S4que7hFxuICAgICAgICBjb25zdCBwcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBbY29udGVudCwgZ3JvdXBTcHJpdGVzXSBvZiBncm91cHMpIHtcbiAgICAgICAgICAgIGlmIChncm91cFNwcml0ZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2godGhpcy5iYXRjaFJlbmRlclNhbWVTVkcoY29udGVudCwgZ3JvdXBTcHJpdGVzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5qOA5p+l57K+54G15piv5ZCm5Zyo6KeG5Y+j5YaFXG4gICAgICovXG4gICAgcHJpdmF0ZSBpc1Nwcml0ZUluVmlld3BvcnQoc3ByaXRlOiBTcHJpdGUsIGNhbWVyYTogQ2FtZXJhKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghc3ByaXRlLm5vZGUgfHwgIWNhbWVyYSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muajgOafpeiKgueCueaYr+WQpua/gOa0u1xuICAgICAgICByZXR1cm4gc3ByaXRlLm5vZGUuYWN0aXZlO1xuICAgIH1cbn1cbiJdfQ==