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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQmF0Y2hSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9TVkdCYXRjaFJlbmRlcmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDJCQUE0SDtBQUM1SCxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFVLENBQUM7QUFFbEUscURBQWtEO0FBRWxEOzs7R0FHRztBQUlJLElBQU0sZ0JBQWdCLEdBQXRCLE1BQU0sZ0JBQWlCLFNBQVEsY0FBUztJQUF4QztRQUNILDZCQUE2Qjs7UUFNckIsdUJBQWtCLEdBQVksSUFBSSxDQUFDO1FBT25DLDJCQUFzQixHQUFXLEVBQUUsQ0FBQztRQVFwQyxpQkFBWSxHQUFXLEVBQUUsQ0FBQztRQU0xQix5QkFBb0IsR0FBWSxLQUFLLENBQUM7UUFVdEMsb0JBQWUsR0FBVyxDQUFDLENBQUM7UUFFcEMsNkJBQTZCO1FBTXJCLGdDQUEyQixHQUFZLEtBQUssQ0FBQztRQVc3QyxvQkFBZSxHQUFXLEdBQUcsQ0FBQztRQUV0Qyw2QkFBNkI7UUFFckIsbUJBQWMsR0FBMEIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQjtRQUN2RSxtQkFBYyxHQUFhLEVBQUUsQ0FBQyxDQUFDLFFBQVE7UUFDdkMsa0JBQWEsR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFNBQVM7UUFDNUQsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsb0JBQWUsR0FBVyxDQUFDLENBQUM7UUFFNUIscUJBQWdCLEdBQUc7WUFDdkIsWUFBWSxFQUFFLENBQUM7WUFDZixVQUFVLEVBQUUsQ0FBQztZQUNiLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixhQUFhLEVBQUUsQ0FBQztTQUNuQixDQUFDO0lBaWNOLENBQUM7SUEvYkcsK0JBQStCO0lBRS9CLE1BQU07UUFDRixJQUFJLENB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eURBQ29DOzJCQXpEN0IsZ0JBQWdCO0lBSDVCLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztJQUMzQixJQUFJLENBQUMscUJBQXFCLENBQUM7SUFDM0IsaUJBQWlCO0dBQ0wsZ0JBQWdCLENBMGdCNUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIFNwcml0ZSwgU3ByaXRlRnJhbWUsIFRleHR1cmUyRCwgSW1hZ2VBc3NldCwgVmVjMywgZGlyZWN0b3IsIENhbWVyYSwgVUlUcmFuc2Zvcm0gfSBmcm9tIFwiY2NcIjtcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUgfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5pbXBvcnQgeyBTVkdTcHJpdGVDYWNoZSB9IGZyb20gXCIuL1NWR1Nwcml0ZUNhY2hlXCI7XHJcblxyXG4vKipcclxuICogU1ZH5om56YeP5riy5p+T5ZmoXHJcbiAqIOS8mOWMluWkp+mHj1NWR+a4suafk+aAp+iDve+8jOWHj+WwkURyYXcgQ2FsbFxyXG4gKi9cclxuQGNjY2xhc3MoXCJTVkdCYXRjaFJlbmRlcmVyXCIpXHJcbkBtZW51KFwiMkQvU1ZHQmF0Y2hSZW5kZXJlclwiKVxyXG5AZXhlY3V0ZUluRWRpdE1vZGVcclxuZXhwb3J0IGNsYXNzIFNWR0JhdGNoUmVuZGVyZXIgZXh0ZW5kcyBDb21wb25lbnQge1xyXG4gICAgLy8gPT09PT09PT09PSDmibnph4/phY3nva4gPT09PT09PT09PVxyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjoh6rliqjlkIjmiblcIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLoh6rliqjlkIjmiblcIixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIGVuYWJsZUF1dG9CYXRjaGluZzogYm9vbGVhbiA9IHRydWU7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQiOaJuei3neemu+mYiOWAvO+8iOWDj+e0oO+8iVwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuWQiOaJuei3neemu1wiLFxyXG4gICAgICAgIG1pbjogMCxcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIGJhdGNoRGlzdGFuY2VUaHJlc2hvbGQ6IG51bWJlciA9IDUwO1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLmnIDlpKfmr4/mibnmlbDph49cIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmr4/mibnmnIDlpKfmlbBcIixcclxuICAgICAgICBtaW46IDEsXHJcbiAgICAgICAgbWF4OiAxMDAsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBtYXhCYXRjaFNpemU6IG51bWJlciA9IDIwO1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjliIbluKfmuLLmn5NcIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLliIbluKfmuLLmn5NcIixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIGVuYWJsZUZyYW1lU3BsaXR0aW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuavj+W4p+a4suafk+aVsOmHj1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuavj+W4p+aVsOmHj1wiLFxyXG4gICAgICAgIG1pbjogMSxcclxuICAgICAgICB2aXNpYmxlOiBmdW5jdGlvbiAodGhpczogU1ZHQmF0Y2hSZW5kZXJlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lbmFibGVGcmFtZVNwbGl0dGluZztcclxuICAgICAgICB9LFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgc3ByaXRlc1BlckZyYW1lOiBudW1iZXIgPSA1O1xyXG5cclxuICAgIC8vID09PT09PT09PT0g5oCn6IO955uR5o6nID09PT09PT09PT1cclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So5oCn6IO955uR5o6nXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5oCn6IO955uR5o6nXCIsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBlbmFibGVQZXJmb3JtYW5jZU1vbml0b3Jpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi55uR5o6n5pu05paw6Ze06ZqU77yI56eS77yJXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi55uR5o6n6Ze06ZqUXCIsXHJcbiAgICAgICAgbWluOiAwLjEsXHJcbiAgICAgICAgbWF4OiA1LFxyXG4gICAgICAgIHZpc2libGU6IGZ1bmN0aW9uICh0aGlzOiBTVkdCYXRjaFJlbmRlcmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmVuYWJsZVBlcmZvcm1hbmNlTW9uaXRvcmluZztcclxuICAgICAgICB9LFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgbW9uaXRvckludGVydmFsOiBudW1iZXIgPSAxLjA7XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhoXpg6jnirbmgIEgPT09PT09PT09PVxyXG5cclxuICAgIHByaXZhdGUgYmF0Y2hlZFNwcml0ZXM6IE1hcDxzdHJpbmcsIFNwcml0ZVtdPiA9IG5ldyBNYXAoKTsgLy8gU1ZH5YaF5a65IC0+IFNwcml0ZeaVsOe7hFxyXG4gICAgcHJpdmF0ZSBwZW5kaW5nU3ByaXRlczogU3ByaXRlW10gPSBbXTsgLy8g5b6F5aSE55CG57K+54G1XHJcbiAgICBwcml2YXRlIGJhdGNoVGV4dHVyZXM6IE1hcDxzdHJpbmcsIFRleHR1cmUyRD4gPSBuZXcgTWFwKCk7IC8vIOaJuemHj+e6ueeQhue8k+WtmFxyXG4gICAgcHJpdmF0ZSBmcmFtZUNvdW50ZXI6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIGxhc3RNb25pdG9yVGltZTogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwcml2YXRlIHBlcmZvcm1hbmNlU3RhdHMgPSB7XHJcbiAgICAgICAgdG90YWxTcHJpdGVzOiAwLFxyXG4gICAgICAgIGJhdGNoQ291bnQ6IDAsXHJcbiAgICAgICAgZHJhd0NhbGxSZWR1Y3Rpb246IDAsXHJcbiAgICAgICAgYXZlcmFnZUJhdGNoU2l6ZTogMCxcclxuICAgICAgICBsYXN0RnJhbWVUaW1lOiAwLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09IOeUn+WRveWRqOacn+aWueazlSA9PT09PT09PT09XHJcblxyXG4gICAgb25Mb2FkKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUJhdGNoUmVuZGVyZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBvbkRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhbnVwQmF0Y2hSZW5kZXJlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShkZWx0YVRpbWU6IG51bWJlcikge1xyXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUF1dG9CYXRjaGluZykge1xyXG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NBdXRvQmF0Y2hpbmcoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUZyYW1lU3BsaXR0aW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc0ZyYW1lU3BsaXR0aW5nKGRlbHRhVGltZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5lbmFibGVQZXJmb3JtYW5jZU1vbml0b3JpbmcpIHtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVQZXJmb3JtYW5jZU1vbml0b3JpbmcoZGVsdGFUaW1lKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhazlhbHmlrnms5UgPT09PT09PT09PVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5omL5Yqo5re75Yqg57K+54G15Yiw5om56YeP5riy5p+TXHJcbiAgICAgKiBAcGFyYW0gc3ByaXRlIOeyvueBtee7hOS7tlxyXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a6577yI5Y+v6YCJ77yM6Ieq5Yqo5LuO57K+54G16I635Y+W77yJXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhZGRTcHJpdGVUb0JhdGNoKHNwcml0ZTogU3ByaXRlLCBzdmdDb250ZW50Pzogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCFzcHJpdGUgfHwgIXNwcml0ZS5zcHJpdGVGcmFtZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLnsr7ngbXmiJbnsr7ngbXluKfml6DmlYhcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBzdmdDb250ZW50IHx8IHRoaXMuZXh0cmFjdFNWR0NvbnRlbnRGcm9tU3ByaXRlKHNwcml0ZSk7XHJcbiAgICAgICAgaWYgKCFjb250ZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuaXoOazleiOt+WPllNWR+WGheWuuVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQXV0b0JhdGNoaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGVuZGluZ1Nwcml0ZXMucHVzaChzcHJpdGUpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkVG9CYXRjaChjb250ZW50LCBzcHJpdGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOaJuemHj+a4suafk+ebuOWQjFNWR+eahOWkmuS4quWunuS+i1xyXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a65XHJcbiAgICAgKiBAcGFyYW0gc3ByaXRlcyDnsr7ngbXmlbDnu4RcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIGJhdGNoUmVuZGVyU2FtZVNWRyhzdmdDb250ZW50OiBzdHJpbmcsIHNwcml0ZXM6IFNwcml0ZVtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKCFzdmdDb250ZW50IHx8IHNwcml0ZXMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIOWIm+W7uuaJuemHj+e6ueeQhlxyXG4gICAgICAgICAgICBjb25zdCBiYXRjaFRleHR1cmUgPSBhd2FpdCB0aGlzLmNyZWF0ZUJhdGNoVGV4dHVyZShzdmdDb250ZW50LCBzcHJpdGVzKTtcclxuICAgICAgICAgICAgaWYgKCFiYXRjaFRleHR1cmUpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIC8vIOW6lOeUqOaJuemHj+e6ueeQhuWIsOaJgOacieeyvueBtVxyXG4gICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IG5ldyBTcHJpdGVGcmFtZSgpO1xyXG4gICAgICAgICAgICBzcHJpdGVGcmFtZS50ZXh0dXJlID0gYmF0Y2hUZXh0dXJlO1xyXG5cclxuICAgICAgICAgICAgc3ByaXRlcy5mb3JFYWNoKChzcHJpdGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChzcHJpdGUgJiYgc3ByaXRlLmlzVmFsaWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzcHJpdGUuc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFRvQmF0Y2goc3ZnQ29udGVudCwgc3ByaXRlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuYmF0Y2hDb3VudCsrO1xyXG4gICAgICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuZHJhd0NhbGxSZWR1Y3Rpb24gKz0gc3ByaXRlcy5sZW5ndGggLSAxO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCLmibnph4/muLLmn5PlpLHotKU6XCIsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmiafooYzoh6rliqjlkIjmiblcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIHBlcmZvcm1BdXRvQmF0Y2hpbmcoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKHRoaXMucGVuZGluZ1Nwcml0ZXMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIOaMiVNWR+WGheWuueWIhue7hFxyXG4gICAgICAgIGNvbnN0IHNwcml0ZUdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBTcHJpdGVbXT4oKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzcHJpdGUgb2YgdGhpcy5wZW5kaW5nU3ByaXRlcykge1xyXG4gICAgICAgICAgICBpZiAoIXNwcml0ZS5pc1ZhbGlkKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB0aGlzLmV4dHJhY3RTVkdDb250ZW50RnJvbVNwcml0ZShzcHJpdGUpO1xyXG4gICAgICAgICAgICBpZiAoY29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFzcHJpdGVHcm91cHMuaGFzKGNvbnRlbnQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3ByaXRlR3JvdXBzLnNldChjb250ZW50LCBbXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBzcHJpdGVHcm91cHMuZ2V0KGNvbnRlbnQpIS5wdXNoKHNwcml0ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOaJuemHj+WkhOeQhuavj+e7hFxyXG4gICAgICAgIGZvciAoY29uc3QgW2NvbnRlbnQsIHNwcml0ZXNdIG9mIHNwcml0ZUdyb3Vwcykge1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmJhdGNoUmVuZGVyU2FtZVNWRyhjb250ZW50LCBzcHJpdGVzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5wZW5kaW5nU3ByaXRlcyA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF6Zmk5omA5pyJ5om56YeP5pWw5o2uXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBjbGVhckFsbEJhdGNoZXMoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5iYXRjaGVkU3ByaXRlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMuYmF0Y2hUZXh0dXJlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucGVuZGluZ1Nwcml0ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgLy8g6YeK5pS+57q555CG6LWE5rqQXHJcbiAgICAgICAgdGhpcy5iYXRjaFRleHR1cmVzLmZvckVhY2goKHRleHR1cmUpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRleHR1cmUpIHtcclxuICAgICAgICAgICAgICAgIHRleHR1cmUuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuYmF0Y2hUZXh0dXJlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5iYXRjaENvdW50ID0gMDtcclxuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuZHJhd0NhbGxSZWR1Y3Rpb24gPSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5oCn6IO957uf6K6hXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBnZXRQZXJmb3JtYW5jZVN0YXRzKCk6IHR5cGVvZiB0aGlzLnBlcmZvcm1hbmNlU3RhdHMge1xyXG4gICAgICAgIGNvbnN0IHRvdGFsQmF0Y2hlZFNwcml0ZXMgPSBBcnJheS5mcm9tKHRoaXMuYmF0Y2hlZFNwcml0ZXMudmFsdWVzKCkpLnJlZHVjZSgoc3VtLCBzcHJpdGVzKSA9PiBzdW0gKyBzcHJpdGVzLmxlbmd0aCwgMCk7XHJcblxyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbFNwcml0ZXMgPSB0b3RhbEJhdGNoZWRTcHJpdGVzICsgdGhpcy5wZW5kaW5nU3ByaXRlcy5sZW5ndGg7XHJcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmF2ZXJhZ2VCYXRjaFNpemUgPVxyXG4gICAgICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuYmF0Y2hDb3VudCA+IDAgPyB0b3RhbEJhdGNoZWRTcHJpdGVzIC8gdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmJhdGNoQ291bnQgOiAwO1xyXG5cclxuICAgICAgICByZXR1cm4geyAuLi50aGlzLnBlcmZvcm1hbmNlU3RhdHMgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS8mOWMlueJueWumuWMuuWfn+WGheeahOeyvueBtVxyXG4gICAgICogQHBhcmFtIGNlbnRlciDkuK3lv4PkvY3nva5cclxuICAgICAqIEBwYXJhbSByYWRpdXMg5Y2K5b6EXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhc3luYyBvcHRpbWl6ZUFyZWEoY2VudGVyOiBWZWMzLCByYWRpdXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGRpcmVjdG9yLmdldFNjZW5lKCk/LmdldENvbXBvbmVudEluQ2hpbGRyZW4oQ2FtZXJhKTtcclxuICAgICAgICBpZiAoIWNhbWVyYSkgcmV0dXJuO1xyXG5cclxuICAgICAgICBjb25zdCBzcHJpdGVzSW5BcmVhOiBTcHJpdGVbXSA9IFtdO1xyXG5cclxuICAgICAgICAvLyDmn6Xmib7ljLrln5/lhoXnmoTnsr7ngbXvvIjnroDljJblrp7njrDvvIlcclxuICAgICAgICAvLyDlrp7pmYXpobnnm67kuK3pnIDopoHmm7Tnsr7noa7nmoTnqbrpl7Tmn6Xor6JcclxuICAgICAgICB0aGlzLmJhdGNoZWRTcHJpdGVzLmZvckVhY2goKHNwcml0ZXMsIGNvbnRlbnQpID0+IHtcclxuICAgICAgICAgICAgc3ByaXRlcy5mb3JFYWNoKChzcHJpdGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChzcHJpdGUubm9kZSAmJiBzcHJpdGUubm9kZS5pc1ZhbGlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByaXRlUG9zID0gc3ByaXRlLm5vZGUud29ybGRQb3NpdGlvbjtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXN0YW5jZSA9IHNwcml0ZVBvcy5zdWJ0cmFjdChjZW50ZXIpLmxlbmd0aCgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGlzdGFuY2UgPD0gcmFkaXVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwcml0ZXNJbkFyZWEucHVzaChzcHJpdGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmIChzcHJpdGVzSW5BcmVhLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgLy8g5bCd6K+V5ZCI5om55Yy65Z+f5YaF55qE57K+54G1XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMub3B0aW1pemVTcHJpdGVHcm91cChzcHJpdGVzSW5BcmVhKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDnp4HmnInmlrnms5UgPT09PT09PT09PVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yid5aeL5YyW5om56YeP5riy5p+T5ZmoXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUJhdGNoUmVuZGVyZXIoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5iYXRjaGVkU3ByaXRlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMuYmF0Y2hUZXh0dXJlcy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMucGVuZGluZ1Nwcml0ZXMgPSBbXTtcclxuICAgICAgICB0aGlzLmZyYW1lQ291bnRlciA9IDA7XHJcbiAgICAgICAgdGhpcy5sYXN0TW9uaXRvclRpbWUgPSAwO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcIlNWR0JhdGNoUmVuZGVyZXIg5Yid5aeL5YyW5a6M5oiQXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF55CG5om56YeP5riy5p+T5ZmoXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2xlYW51cEJhdGNoUmVuZGVyZXIoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5jbGVhckFsbEJhdGNoZXMoKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIlNWR0JhdGNoUmVuZGVyZXIg5riF55CG5a6M5oiQXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5aSE55CG6Ieq5Yqo5ZCI5om5XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcHJvY2Vzc0F1dG9CYXRjaGluZygpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5wZW5kaW5nU3ByaXRlcy5sZW5ndGggPj0gdGhpcy5tYXhCYXRjaFNpemUpIHtcclxuICAgICAgICAgICAgdGhpcy5wZXJmb3JtQXV0b0JhdGNoaW5nKCkuY2F0Y2goY29uc29sZS5lcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5aSE55CG5YiG5bin5riy5p+TXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcHJvY2Vzc0ZyYW1lU3BsaXR0aW5nKGRlbHRhVGltZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5mcmFtZUNvdW50ZXIrKztcclxuXHJcbiAgICAgICAgLy8g5q+PTuW4p+WkhOeQhuS4gOaJuVxyXG4gICAgICAgIGlmICh0aGlzLmZyYW1lQ291bnRlciAlIE1hdGgubWF4KDEsIE1hdGguZmxvb3IoNjAgLyB0aGlzLnNwcml0ZXNQZXJGcmFtZSkpID09PSAwKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBlbmRpbmdTcHJpdGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5wZW5kaW5nU3ByaXRlcy5zcGxpY2UoMCwgdGhpcy5zcHJpdGVzUGVyRnJhbWUpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzU3ByaXRlQmF0Y2goYmF0Y2gpLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5pu05paw5oCn6IO955uR5o6nXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgdXBkYXRlUGVyZm9ybWFuY2VNb25pdG9yaW5nKGRlbHRhVGltZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5sYXN0TW9uaXRvclRpbWUgKz0gZGVsdGFUaW1lO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5sYXN0TW9uaXRvclRpbWUgPj0gdGhpcy5tb25pdG9ySW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLmdldFBlcmZvcm1hbmNlU3RhdHMoKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFNWR+aJuemHj+a4suafk+e7n+iuoTpcclxuICAgICAgICAgICAgICAgIOaAu+eyvueBteaVsDogJHtzdGF0cy50b3RhbFNwcml0ZXN9XHJcbiAgICAgICAgICAgICAgICDmibnmrKHmlbA6ICR7c3RhdHMuYmF0Y2hDb3VudH1cclxuICAgICAgICAgICAgICAgIERyYXcgQ2FsbOWHj+WwkTogJHtzdGF0cy5kcmF3Q2FsbFJlZHVjdGlvbn1cclxuICAgICAgICAgICAgICAgIOW5s+Wdh+aJueWkp+WwjzogJHtzdGF0cy5hdmVyYWdlQmF0Y2hTaXplLnRvRml4ZWQoMil9XHJcbiAgICAgICAgICAgIGApO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5sYXN0TW9uaXRvclRpbWUgPSAwO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS7jueyvueBteaPkOWPllNWR+WGheWuuVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGV4dHJhY3RTVkdDb250ZW50RnJvbVNwcml0ZShzcHJpdGU6IFNwcml0ZSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgICAgIC8vIOi/memHjOmcgOimgeagueaNruWunumZhemhueebrue7k+aehOiOt+WPllNWR+WGheWuuVxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuS4gOS4quagh+ivhuesplxyXG4gICAgICAgIGlmIChzcHJpdGUubm9kZSkge1xyXG4gICAgICAgICAgICBjb25zdCBzcHJpdGVDb21wID0gc3ByaXRlLm5vZGUuZ2V0Q29tcG9uZW50KFwiU1ZHU3ByaXRlXCIpO1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlQ29tcCAmJiAoc3ByaXRlQ29tcCBhcyBhbnkpLnN2Z0NvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAoc3ByaXRlQ29tcCBhcyBhbnkpLnN2Z0NvbnRlbnQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmt7vliqDliLDmibnmrKFcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhZGRUb0JhdGNoKHN2Z0NvbnRlbnQ6IHN0cmluZywgc3ByaXRlOiBTcHJpdGUpOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuYmF0Y2hlZFNwcml0ZXMuaGFzKHN2Z0NvbnRlbnQpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hlZFNwcml0ZXMuc2V0KHN2Z0NvbnRlbnQsIFtdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5iYXRjaGVkU3ByaXRlcy5nZXQoc3ZnQ29udGVudCkhO1xyXG4gICAgICAgIC8vIOS9v+eUqGluZGV4T2bmm7/ku6NpbmNsdWRlc+S7peWFvOWuueabtOS9jkVT54mI5pysXHJcbiAgICAgICAgaWYgKGJhdGNoLmluZGV4T2Yoc3ByaXRlKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgYmF0Y2gucHVzaChzcHJpdGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIm+W7uuaJuemHj+e6ueeQhlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUJhdGNoVGV4dHVyZShzdmdDb250ZW50OiBzdHJpbmcsIHNwcml0ZXM6IFNwcml0ZVtdKTogUHJvbWlzZTxUZXh0dXJlMkQgfCBudWxsPiB7XHJcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgYmF0Y2hfJHtzdmdDb250ZW50fV8ke3Nwcml0ZXMubGVuZ3RofWA7XHJcblxyXG4gICAgICAgIC8vIOajgOafpee8k+WtmFxyXG4gICAgICAgIGlmICh0aGlzLmJhdGNoVGV4dHVyZXMuaGFzKGNhY2hlS2V5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5iYXRjaFRleHR1cmVzLmdldChjYWNoZUtleSkhO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g6K6h566X5om56YeP57q555CG5bC65a+4XHJcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoU2l6ZSA9IHRoaXMuY2FsY3VsYXRlQmF0Y2hUZXh0dXJlU2l6ZShzcHJpdGVzKTtcclxuICAgICAgICAgICAgaWYgKGJhdGNoU2l6ZS53aWR0aCA9PT0gMCB8fCBiYXRjaFNpemUuaGVpZ2h0ID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5Yib5bu6Q2FudmFzXHJcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgICAgIGNhbnZhcy53aWR0aCA9IGJhdGNoU2l6ZS53aWR0aDtcclxuICAgICAgICAgICAgY2FudmFzLmhlaWdodCA9IGJhdGNoU2l6ZS5oZWlnaHQ7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgICAgICAgICBpZiAoIWN0eCkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+WQ2FudmFzIDJE5LiK5LiL5paHXCIpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDmuIXnqbrnlLvluINcclxuICAgICAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgLy8g6I635Y+W5Y2V5LiqU1ZH57q555CGXHJcbiAgICAgICAgICAgIGNvbnN0IHNpbmdsZVRleHR1cmUgPSBhd2FpdCBTVkdTcHJpdGVDYWNoZS5nZXRTaW1wbGVTVkdTcHJpdGVGcmFtZShcclxuICAgICAgICAgICAgICAgIHN2Z0NvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICBNYXRoLm1heCguLi5zcHJpdGVzLm1hcCgocykgPT4gdGhpcy5nZXRTcHJpdGVTaXplKHMpLndpZHRoKSlcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghc2luZ2xlVGV4dHVyZS50ZXh0dXJlKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCLml6Dms5Xojrflj5ZTVkfnurnnkIZcIik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIOe7mOWItuaJgOacieWunuS+i++8iOeugOWMlu+8muW5s+mTuu+8iVxyXG4gICAgICAgICAgICBjb25zdCBjb2xzID0gTWF0aC5jZWlsKE1hdGguc3FydChzcHJpdGVzLmxlbmd0aCkpO1xyXG4gICAgICAgICAgICBjb25zdCByb3dzID0gTWF0aC5jZWlsKHNwcml0ZXMubGVuZ3RoIC8gY29scyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNlbGxXaWR0aCA9IGJhdGNoU2l6ZS53aWR0aCAvIGNvbHM7XHJcbiAgICAgICAgICAgIGNvbnN0IGNlbGxIZWlnaHQgPSBiYXRjaFNpemUuaGVpZ2h0IC8gcm93cztcclxuXHJcbiAgICAgICAgICAgIC8vIOi/memHjOW6lOivpeS9v+eUqOWunumZheeahFNWR+a4suafk+mAu+i+kVxyXG4gICAgICAgICAgICAvLyDnroDljJblrp7njrDvvJrkvb/nlKjljaDkvY3nrKZcclxuICAgICAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmdiYSgwLCAwLCAwLCAwLjEpXCI7XHJcbiAgICAgICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgLy8g5Yib5bu657q555CGXHJcbiAgICAgICAgICAgIGNvbnN0IGltYWdlQXNzZXQgPSBuZXcgSW1hZ2VBc3NldChjYW52YXMpO1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUyRCgpO1xyXG4gICAgICAgICAgICB0ZXh0dXJlLmltYWdlID0gaW1hZ2VBc3NldDtcclxuXHJcbiAgICAgICAgICAgIC8vIOe8k+WtmOe6ueeQhlxyXG4gICAgICAgICAgICB0aGlzLmJhdGNoVGV4dHVyZXMuc2V0KGNhY2hlS2V5LCB0ZXh0dXJlKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCLliJvlu7rmibnph4/nurnnkIblpLHotKU6XCIsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6h566X5om56YeP57q555CG5bC65a+4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2FsY3VsYXRlQmF0Y2hUZXh0dXJlU2l6ZShzcHJpdGVzOiBTcHJpdGVbXSk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICAgICAgaWYgKHNwcml0ZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOeugOWNleiuoeeul++8muWfuuS6jueyvueBteaVsOmHj+WSjOW5s+Wdh+WwuuWvuFxyXG4gICAgICAgIGNvbnN0IHRvdGFsQXJlYSA9IHNwcml0ZXMucmVkdWNlKChzdW0sIHNwcml0ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBzaXplID0gdGhpcy5nZXRTcHJpdGVTaXplKHNwcml0ZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdW0gKyBzaXplLndpZHRoICogc2l6ZS5oZWlnaHQ7XHJcbiAgICAgICAgfSwgMCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGF2Z0FyZWEgPSB0b3RhbEFyZWEgLyBzcHJpdGVzLmxlbmd0aDtcclxuICAgICAgICBjb25zdCBzcHJpdGVDb3VudCA9IHNwcml0ZXMubGVuZ3RoO1xyXG5cclxuICAgICAgICAvLyDkvLDnrpfnurnnkIblsLrlr7jvvIjkv53mjIHlrr3pq5jmr5TvvIlcclxuICAgICAgICBjb25zdCBlc3RpbWF0ZWRQaXhlbHMgPSBhdmdBcmVhICogc3ByaXRlQ291bnQgKiAxLjU7IC8vIOWMheWQq3BhZGRpbmdcclxuICAgICAgICBjb25zdCBzaWRlID0gTWF0aC5jZWlsKE1hdGguc3FydChlc3RpbWF0ZWRQaXhlbHMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHsgd2lkdGg6IHNpZGUsIGhlaWdodDogc2lkZSB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W57K+54G15bC65a+4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZ2V0U3ByaXRlU2l6ZShzcHJpdGU6IFNwcml0ZSk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XHJcbiAgICAgICAgaWYgKHNwcml0ZS5ub2RlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHVpVHJhbnNmb3JtID0gc3ByaXRlLm5vZGUuZ2V0Q29tcG9uZW50KFVJVHJhbnNmb3JtKTtcclxuICAgICAgICAgICAgaWYgKHVpVHJhbnNmb3JtKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyB3aWR0aDogdWlUcmFuc2Zvcm0ud2lkdGgsIGhlaWdodDogdWlUcmFuc2Zvcm0uaGVpZ2h0IH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChzcHJpdGUuc3ByaXRlRnJhbWUpIHtcclxuICAgICAgICAgICAgLy8g5a+55LqOU1ZH57K+54G177yM5L2/55So57K+54G15bin55qE5Y6f5aeL5bC65a+4XHJcbiAgICAgICAgICAgIC8vIOaIluiAheS9v+eUqFVJVHJhbnNmb3Jt55qE5bC65a+4XHJcbiAgICAgICAgICAgIHJldHVybiB7IHdpZHRoOiAxMDAsIGhlaWdodDogMTAwIH07IC8vIOeugOWMlu+8mui/lOWbnum7mOiupOWwuuWvuFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHsgd2lkdGg6IDEwMCwgaGVpZ2h0OiAxMDAgfTsgLy8g6buY6K6k5bC65a+4XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlpITnkIbnsr7ngbXmibnmrKFcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzU3ByaXRlQmF0Y2goc3ByaXRlczogU3ByaXRlW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICAvLyDmjIlTVkflhoXlrrnliIbnu4RcclxuICAgICAgICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgU3ByaXRlW10+KCk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3Qgc3ByaXRlIG9mIHNwcml0ZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IHRoaXMuZXh0cmFjdFNWR0NvbnRlbnRGcm9tU3ByaXRlKHNwcml0ZSk7XHJcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWdyb3Vwcy5oYXMoY29udGVudCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBncm91cHMuc2V0KGNvbnRlbnQsIFtdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGdyb3Vwcy5nZXQoY29udGVudCkhLnB1c2goc3ByaXRlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5aSE55CG5q+P5Liq57uEXHJcbiAgICAgICAgZm9yIChjb25zdCBbY29udGVudCwgZ3JvdXBTcHJpdGVzXSBvZiBncm91cHMpIHtcclxuICAgICAgICAgICAgaWYgKGdyb3VwU3ByaXRlcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmJhdGNoUmVuZGVyU2FtZVNWRyhjb250ZW50LCBncm91cFNwcml0ZXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LyY5YyW57K+54G157uEXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgb3B0aW1pemVTcHJpdGVHcm91cChzcHJpdGVzOiBTcHJpdGVbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIC8vIOaMiVNWR+WGheWuueWIhue7hFxyXG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBTcHJpdGVbXT4oKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzcHJpdGUgb2Ygc3ByaXRlcykge1xyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gdGhpcy5leHRyYWN0U1ZHQ29udGVudEZyb21TcHJpdGUoc3ByaXRlKTtcclxuICAgICAgICAgICAgaWYgKGNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgIGlmICghZ3JvdXBzLmhhcyhjb250ZW50KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGdyb3Vwcy5zZXQoY29udGVudCwgW10pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZ3JvdXBzLmdldChjb250ZW50KSEucHVzaChzcHJpdGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDlkIjmibnmr4/kuKrnu4RcclxuICAgICAgICBjb25zdCBwcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgW2NvbnRlbnQsIGdyb3VwU3ByaXRlc10gb2YgZ3JvdXBzKSB7XHJcbiAgICAgICAgICAgIGlmIChncm91cFNwcml0ZXMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgcHJvbWlzZXMucHVzaCh0aGlzLmJhdGNoUmVuZGVyU2FtZVNWRyhjb250ZW50LCBncm91cFNwcml0ZXMpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5qOA5p+l57K+54G15piv5ZCm5Zyo6KeG5Y+j5YaFXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgaXNTcHJpdGVJblZpZXdwb3J0KHNwcml0ZTogU3ByaXRlLCBjYW1lcmE6IENhbWVyYSk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGlmICghc3ByaXRlLm5vZGUgfHwgIWNhbWVyYSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICAvLyDnroDljJblrp7njrDvvJrmo4Dmn6XoioLngrnmmK/lkKbmv4DmtLtcclxuICAgICAgICByZXR1cm4gc3ByaXRlLm5vZGUuYWN0aXZlO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==