"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGAtlasBuilder = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu, icon } = cc_1._decorator;
const SVGSpriteCache_1 = require("./SVGSpriteCache");
/**
 * SVG图集构建器
 * 将多个SVG打包到单个纹理图集中，减少纹理切换开销
 */
let SVGAtlasBuilder = class SVGAtlasBuilder extends cc_1.Component {
    constructor() {
        // ========== 图集配置 ==========
        super(...arguments);
        this.maxAtlasWidth = 1024;
        this.maxAtlasHeight = 1024;
        this.padding = 2;
        this.enableAutoAtlas = true;
        this.buildThreshold = 10;
        // ========== 性能配置 ==========
        this.enableRuntimeUpdates = false;
        this.maxAtlases = 3;
        // ========== 内部状态 ==========
        this.atlases = new Map(); // 图集名称 -> 图集数据
        this.svgToAtlasMapping = new Map(); // SVG内容 -> 图集映射
        this.pendingSVGs = new Set(); // 待处理SVG
    }
    // ========== 生命周期方法 ==========
    onLoad() {
        this.initializeAtlasBuilder();
    }
    onDestroy() {
        this.cleanupAtlasBuilder();
    }
    update(deltaTime) {
        if (this.enableAutoAtlas && this.pendingSVGs.size >= this.buildThreshold) {
            this.processPendingSVGs().catch(console.error);
        }
    }
    // ========== 公共方法 ==========
    /**
     * 添加SVG到图集构建队列
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     */
    addSVGToAtlas(svgContent, width, height, color) {
        const key = this.generateSVGKey(svgContent, width, height, color);
        if (!this.svgToAtlasMapping.has(key)) {
            this.pendingSVGs.add(key);
            // 如果启用了自动构建且达到阈值，立即处理
            if (this.enableAutoAtlas && this.pendingSVGs.size >= this.buildThreshold) {
                this.processPendingSVGs().catch(console.error);
            }
        }
    }
    /**
     * 获取SVG的图集精灵帧
     * @param svgContent SVG内容
     * @param width 宽度
     * @param height 高度
     * @param color 颜色（可选）
     * @returns Promise<SpriteFrame> 返回图集中的精灵帧
     */
    async getSVGFromAtlas(svgContent, width, height, color) {
        const key = this.generateSVGKey(svgContent, width, height, color);
        // 检查是否已在图集中
        const mapping = this.svgToAtlasMapping.get(key);
        if (mapping) {
            const atlas = this.atlases.get(mapping.atlasName);
            if (atlas) {
                return atlas.spriteFrame;
            }
        }
        // 如果不在图集中且启用了运行时更新，尝试添加到图集
        if (this.enableRuntimeUpdates) {
            await this.addSVGToAtlasAndBuild(svgContent, width, height, color);
            // 重新检查
            const newMapping = this.svgToAtlasMapping.get(key);
            if (newMapping) {
                const atlas = this.atlases.get(newMapping.atlasName);
                if (atlas) {
                    return atlas.spriteFrame;
                }
            }
        }
        return null;
    }
    /**
     * 手动构建图集
     * @param svgContents SVG内容数组（带尺寸和颜色）
     */
    async buildAtlas(svgContents) {
        if (svgContents.length === 0) {
            console.warn("没有SVG内容可构建图集");
            return null;
        }
        try {
            // 检查图集数量限制
            if (this.atlases.size >= this.maxAtlases) {
                console.warn("已达到最大图集数量限制");
                return this.mergeOrReplaceAtlas(svgContents);
            }
            // 创建新图集
            const atlasName = `atlas_${Date.now()}`;
            const atlasData = await this.createAtlas(atlasName, svgContents);
            if (atlasData) {
                this.atlases.set(atlasName, atlasData);
                // 更新映射
                svgContents.forEach((svg) => {
                    const key = this.generateSVGKey(svg.content, svg.width, svg.height, svg.color);
                    this.svgToAtlasMapping.set(key, {
                        atlasName,
                        entryKey: key,
                    });
                });
                console.log(`图集构建完成: ${atlasName}, 包含 ${svgContents.length} 个SVG`);
                return atlasData;
            }
            return null;
        }
        catch (error) {
            console.error("构建图集失败:", error);
            return null;
        }
    }
    /**
     * 获取所有图集信息
     */
    getAllAtlasInfo() {
        const info = [];
        this.atlases.forEach((atlas, name) => {
            info.push({
                name,
                svgCount: atlas.svgEntries.size,
                width: atlas.width,
                height: atlas.height,
                usedSpace: atlas.usedSpace,
            });
        });
        return info;
    }
    /**
     * 清除指定图集
     * @param atlasName 图集名称
     */
    clearAtlas(atlasName) {
        const atlas = this.atlases.get(atlasName);
        if (atlas) {
            // 释放纹理资源
            if (atlas.texture) {
                atlas.texture.destroy();
            }
            // 移除映射
            atlas.svgEntries.forEach((entry, key) => {
                this.svgToAtlasMapping.delete(key);
            });
            // 移除图集
            this.atlases.delete(atlasName);
            console.log(`已清除图集: ${atlasName}`);
        }
    }
    /**
     * 清除所有图集
     */
    clearAllAtlases() {
        this.atlases.forEach((atlas, name) => {
            if (atlas.texture) {
                atlas.texture.destroy();
            }
        });
        this.atlases.clear();
        this.svgToAtlasMapping.clear();
        this.pendingSVGs.clear();
        console.log("已清除所有图集");
    }
    /**
     * 优化图集空间使用
     */
    async optimizeAtlases() {
        const optimizationPromises = [];
        this.atlases.forEach((atlas, name) => {
            if (atlas.usedSpace < 0.6) {
                // 空间使用率低于60%
                optimizationPromises.push(this.optimizeAtlas(name));
            }
        });
        await Promise.all(optimizationPromises);
    }
    // ========== 私有方法 ==========
    /**
     * 初始化图集构建器
     */
    initializeAtlasBuilder() {
        this.atlases.clear();
        this.svgToAtlasMapping.clear();
        this.pendingSVGs.clear();
        console.log("SVGAtlasBuilder 初始化完成");
    }
    /**
     * 清理图集构建器
     */
    cleanupAtlasBuilder() {
        this.clearAllAtlases();
        console.log("SVGAtlasBuilder 清理完成");
    }
    /**
     * 生成SVG键
     */
    generateSVGKey(svgContent, width, height, color) {
        const colorPart = color || "default";
        const hash = this.calculateSimpleHash(svgContent);
        return `${hash}_${width}x${height}_${colorPart}`;
    }
    /**
     * 计算简单哈希
     */
    calculateSimpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).substring(0, 8);
    }
    /**
     * 处理待处理SVG
     */
    async processPendingSVGs() {
        if (this.pendingSVGs.size === 0)
            return;
        // 收集待处理SVG的详细信息
        const svgDetails = [];
        // 这里需要从pendingSVGs中提取实际SVG内容
        // 简化实现：使用占位符
        this.pendingSVGs.forEach((key) => {
            // 解析键获取尺寸等信息
            const match = key.match(/(.+)_(\d+)x(\d+)_(.+)/);
            if (match) {
                const [, hash, widthStr, heightStr, color] = match;
                svgDetails.push({
                    content: `svg_hash_${hash}`, // 简化：实际应该存储SVG内容
                    width: parseInt(widthStr),
                    height: parseInt(heightStr),
                    color: color !== "default" ? color : undefined,
                });
            }
        });
        if (svgDetails.length > 0) {
            await this.buildAtlas(svgDetails);
            this.pendingSVGs.clear();
        }
    }
    /**
     * 添加SVG到图集并构建
     */
    async addSVGToAtlasAndBuild(svgContent, width, height, color) {
        const key = this.generateSVGKey(svgContent, width, height, color);
        // 检查是否有空间足够的现有图集
        const suitableAtlas = this.findSuitableAtlas(width, height);
        if (suitableAtlas) {
            await this.addToExistingAtlas(suitableAtlas.name, svgContent, width, height, color);
        }
        else {
            // 创建新图集
            await this.buildAtlas([
                {
                    content: svgContent,
                    width,
                    height,
                    color,
                },
            ]);
        }
    }
    /**
     * 查找合适的现有图集
     */
    findSuitableAtlas(width, height) {
        let bestAtlas = null;
        let bestSpaceUsage = Infinity;
        this.atlases.forEach((atlas) => {
            // 检查图集是否有足够空间
            if (atlas.usedSpace < 0.9 && // 使用率低于90%
                width <= atlas.width * (1 - atlas.usedSpace) &&
                height <= atlas.height * (1 - atlas.usedSpace)) {
                // 选择空间使用率最高的图集（最满但仍有空间）
                const spaceLeft = 1 - atlas.usedSpace;
                if (spaceLeft < bestSpaceUsage) {
                    bestSpaceUsage = spaceLeft;
                    bestAtlas = atlas;
                }
            }
        });
        return bestAtlas;
    }
    /**
     * 添加到现有图集
     */
    async addToExistingAtlas(atlasName, svgContent, width, height, color) {
        const atlas = this.atlases.get(atlasName);
        if (!atlas)
            return false;
        try {
            // 这里应该实现实际的图集更新逻辑
            // 简化实现：重新构建整个图集
            const allEntries = Array.from(atlas.svgEntries.values()).map((entry) => ({
                content: entry.svgContent,
                width: entry.size.x,
                height: entry.size.y,
                color: this.extractColorFromSVG(entry.svgContent),
            }));
            // 添加新条目
            allEntries.push({
                content: svgContent,
                width,
                height,
                color,
            });
            // 重新构建图集
            const newAtlas = await this.createAtlas(`${atlasName}_updated`, allEntries);
            if (newAtlas) {
                // 替换旧图集
                this.clearAtlas(atlasName);
                this.atlases.set(`${atlasName}_updated`, newAtlas);
                // 更新映射
                const key = this.generateSVGKey(svgContent, width, height, color);
                this.svgToAtlasMapping.set(key, {
                    atlasName: `${atlasName}_updated`,
                    entryKey: key,
                });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("添加到现有图集失败:", error);
            return false;
        }
    }
    /**
     * 从SVG提取颜色
     */
    extractColorFromSVG(svgContent) {
        const colorMatch = svgContent.match(/fill="([^"]*)"/);
        if (colorMatch && colorMatch[1] !== "none" && colorMatch[1] !== "transparent") {
            return colorMatch[1];
        }
        return undefined;
    }
    /**
     * 创建图集
     */
    async createAtlas(name, svgContents) {
        if (svgContents.length === 0)
            return null;
        try {
            // 计算图集尺寸
            const atlasSize = this.calculateAtlasSize(svgContents);
            if (atlasSize.width === 0 || atlasSize.height === 0) {
                return null;
            }
            // 创建Canvas
            const canvas = document.createElement("canvas");
            canvas.width = atlasSize.width;
            canvas.height = atlasSize.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                throw new Error("无法获取Canvas 2D上下文");
            }
            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 矩形包装算法（简化：简单网格布局）
            const entries = new Map();
            const cellSize = this.calculateCellSize(svgContents);
            const cols = Math.floor(atlasSize.width / cellSize);
            const rows = Math.ceil(svgContents.length / cols);
            let index = 0;
            for (const svg of svgContents) {
                if (index >= cols * rows)
                    break;
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = col * cellSize + this.padding;
                const y = row * cellSize + this.padding;
                const entryWidth = cellSize - this.padding * 2;
                const entryHeight = cellSize - this.padding * 2;
                // 获取SVG精灵帧
                const spriteFrame = await SVGSpriteCache_1.SVGSpriteCache.getSVGSpriteFrame(svg.content, entryWidth, entryHeight, svg.color);
                // 这里应该将SVG绘制到Canvas的对应位置
                // 简化实现：绘制一个占位矩形
                ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                ctx.fillRect(x, y, entryWidth, entryHeight);
                // 创建图集条目
                const entryKey = this.generateSVGKey(svg.content, svg.width, svg.height, svg.color);
                entries.set(entryKey, {
                    svgContent: svg.content,
                    uvRect: new cc_1.Rect(x / atlasSize.width, y / atlasSize.height, entryWidth / atlasSize.width, entryHeight / atlasSize.height),
                    pixelRect: new cc_1.Rect(x, y, entryWidth, entryHeight),
                    size: new cc_1.Vec2(svg.width, svg.height),
                });
                index++;
            }
            // 创建纹理
            const imageAsset = new cc_1.ImageAsset(canvas);
            const texture = new cc_1.Texture2D();
            texture.image = imageAsset;
            // 创建精灵帧
            const spriteFrame = new cc_1.SpriteFrame();
            spriteFrame.texture = texture;
            // 计算空间使用率
            const totalCells = cols * rows;
            const usedCells = Math.min(svgContents.length, totalCells);
            const usedSpace = (usedCells * cellSize * cellSize) / (atlasSize.width * atlasSize.height);
            return {
                name,
                texture,
                spriteFrame,
                svgEntries: entries,
                usedSpace,
                width: atlasSize.width,
                height: atlasSize.height,
            };
        }
        catch (error) {
            console.error("创建图集失败:", error);
            return null;
        }
    }
    /**
     * 计算图集尺寸
     */
    calculateAtlasSize(svgContents) {
        if (svgContents.length === 0) {
            return { width: 0, height: 0 };
        }
        // 简单计算：基于SVG数量和最大尺寸
        const maxWidth = Math.max(...svgContents.map((svg) => svg.width));
        const maxHeight = Math.max(...svgContents.map((svg) => svg.height));
        // 计算网格布局
        const cellSize = Math.max(maxWidth, maxHeight) + this.padding * 2;
        const svgCount = svgContents.length;
        // 估算所需行列
        const estimatedCells = svgCount;
        const side = Math.ceil(Math.sqrt(estimatedCells));
        let width = Math.min(side * cellSize, this.maxAtlasWidth);
        let height = Math.min(side * cellSize, this.maxAtlasHeight);
        // 确保尺寸是2的幂（纹理优化）
        width = this.nextPowerOfTwo(width);
        height = this.nextPowerOfTwo(height);
        return { width, height };
    }
    /**
     * 计算单元格尺寸
     */
    calculateCellSize(svgContents) {
        if (svgContents.length === 0)
            return 0;
        // 找到最大尺寸并加上padding
        const maxWidth = Math.max(...svgContents.map((svg) => svg.width));
        const maxHeight = Math.max(...svgContents.map((svg) => svg.height));
        const maxSize = Math.max(maxWidth, maxHeight);
        return maxSize + this.padding * 2;
    }
    /**
     * 下一个2的幂
     */
    nextPowerOfTwo(n) {
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        n++;
        return Math.min(Math.max(n, 64), this.maxAtlasWidth);
    }
    /**
     * 合并或替换图集
     */
    async mergeOrReplaceAtlas(svgContents) {
        // 找到使用率最低的图集
        let lowestUsageAtlas = null;
        this.atlases.forEach((atlas, name) => {
            if (!lowestUsageAtlas || atlas.usedSpace < lowestUsageAtlas.usage) {
                lowestUsageAtlas = { name: name, usage: atlas.usedSpace };
            }
        });
        if (lowestUsageAtlas) {
            // 清除使用率最低的图集
            this.clearAtlas(lowestUsageAtlas.name);
            // 创建新图集
            return this.buildAtlas(svgContents);
        }
        return null;
    }
    /**
     * 优化指定图集
     */
    async optimizeAtlas(atlasName) {
        const atlas = this.atlases.get(atlasName);
        if (!atlas)
            return;
        // 收集所有条目
        const allEntries = Array.from(atlas.svgEntries.values()).map((entry) => ({
            content: entry.svgContent,
            width: entry.size.x,
            height: entry.size.y,
            color: this.extractColorFromSVG(entry.svgContent),
        }));
        // 重新构建图集（可能更紧凑）
        const optimizedAtlas = await this.createAtlas(`${atlasName}_optimized`, allEntries);
        if (optimizedAtlas && optimizedAtlas.usedSpace > atlas.usedSpace) {
            // 替换旧图集
            this.clearAtlas(atlasName);
            this.atlases.set(`${atlasName}_optimized`, optimizedAtlas);
            // 更新映射
            optimizedAtlas.svgEntries.forEach((entry, key) => {
                this.svgToAtlasMapping.set(key, {
                    atlasName: `${atlasName}_optimized`,
                    entryKey: key,
                });
            });
            console.log(`图集优化完成: ${atlasName} -> ${atlasName}_optimized`);
        }
    }
};
exports.SVGAtlasBuilder = SVGAtlasBuilder;
__decorate([
    property({
        tooltip: "图集最大宽度",
        displayName: "最大宽度",
        min: 64,
        max: 4096,
    })
], SVGAtlasBuilder.prototype, "maxAtlasWidth", void 0);
__decorate([
    property({
        tooltip: "图集最大高度",
        displayName: "最大高度",
        min: 64,
        max: 4096,
    })
], SVGAtlasBuilder.prototype, "maxAtlasHeight", void 0);
__decorate([
    property({
        tooltip: "纹理间距（像素）",
        displayName: "纹理间距",
        min: 0,
        max: 32,
    })
], SVGAtlasBuilder.prototype, "padding", void 0);
__decorate([
    property({
        tooltip: "启用自动图集构建",
        displayName: "自动构建",
    })
], SVGAtlasBuilder.prototype, "enableAutoAtlas", void 0);
__decorate([
    property({
        tooltip: "图集构建阈值（SVG数量）",
        displayName: "构建阈值",
        min: 2,
        max: 100,
    })
], SVGAtlasBuilder.prototype, "buildThreshold", void 0);
__decorate([
    property({
        tooltip: "启用运行时图集更新",
        displayName: "运行时更新",
    })
], SVGAtlasBuilder.prototype, "enableRuntimeUpdates", void 0);
__decorate([
    property({
        tooltip: "最大图集数量",
        displayName: "最大图集数",
        min: 1,
        max: 10,
    })
], SVGAtlasBuilder.prototype, "maxAtlases", void 0);
exports.SVGAtlasBuilder = SVGAtlasBuilder = __decorate([
    ccclass("SVGAtlasBuilder"),
    icon("../../Inkpen.png"),
    menu("2D/SVGAtlasBuilder"),
    executeInEditMode
], SVGAtlasBuilder);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQXRsYXNCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2NvbXBvbmVudHMvU1ZHQXRsYXNCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDJCQUEyRjtBQUMzRixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBRXhFLHFEQUFrRDtBQWlDbEQ7OztHQUdHO0FBS0ksSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZ0IsU0FBUSxjQUFTO0lBQXZDO1FBQ0gsNkJBQTZCOztRQVFyQixrQkFBYSxHQUFXLElBQUksQ0FBQztRQVE3QixtQkFBYyxHQUFXLElBQUksQ0FBQztRQVE5QixZQUFPLEdBQVcsQ0FBQyxDQUFDO1FBTXBCLG9CQUFlLEdBQVksSUFBSSxDQUFDO1FBUWhDLG1CQUFjLEdBQVcsRUFBRSxDQUFDO1FBRXBDLDZCQUE2QjtRQU1yQix5QkFBb0IsR0FBWSxLQUFLLENBQUM7UUFRdEMsZUFBVSxHQUFXLENBQUMsQ0FBQztRQUUvQiw2QkFBNkI7UUFFckIsWUFBTyxHQUEyQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsZUFBZTtRQUM1RCxzQkFBaUIsR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQjtRQUMxRSxnQkFBVyxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUztJQTRvQjNELENBQUM7SUExb0JHLCtCQUErQjtJQUUvQixNQUFNO1FBQ0YsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVELFNBQVM7UUFDTCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRUQsTUFBTSxDQUFDLFNBQWlCO1FBQ3BCLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUks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WixDQUFDO3VEQUNvQztBQVE5QjtJQU5QLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxNQUFNO1FBQ25CLEdBQUcsRUFBRSxDQUFDO1FBQ04sR0FBRyxFQUFFLEVBQUU7S0FDVixDQUFDO2dEQUMwQjtBQU1wQjtJQUpQLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxNQUFNO0tBQ3RCLENBQUM7d0RBQ3NDO0FBUWhDO0lBTlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLGVBQWU7UUFDeEIsV0FBVyxFQUFFLE1BQU07UUFDbkIsR0FBRyxFQUFFLENBQUM7UUFDTixHQUFHLEVBQUUsR0FBRztLQUNYLENBQUM7dURBQ2tDO0FBUTVCO0lBSlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFdBQVc7UUFDcEIsV0FBVyxFQUFFLE9BQU87S0FDdkIsQ0FBQzs2REFDNEM7QUFRdEM7SUFOUCxRQUFRLENBQUM7UUFDTixPQUFPLEVBQUUsUUFBUTtRQUNqQixXQUFXLEVBQUUsT0FBTztRQUNwQixHQUFHLEVBQUUsQ0FBQztRQUNOLEdBQUcsRUFBRSxFQUFFO0tBQ1YsQ0FBQzttREFDNkI7MEJBdkR0QixlQUFlO0lBSjNCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztJQUMxQixJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDeEIsSUFBSSxDQUFDLG9CQUFvQixDQUFDO0lBQzFCLGlCQUFpQjtHQUNMLGVBQWUsQ0F5c0IzQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IF9kZWNvcmF0b3IsIENvbXBvbmVudCwgU3ByaXRlRnJhbWUsIFRleHR1cmUyRCwgSW1hZ2VBc3NldCwgUmVjdCwgVmVjMiB9IGZyb20gXCJjY1wiO1xuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUsIGljb24gfSA9IF9kZWNvcmF0b3I7XG5cbmltcG9ydCB7IFNWR1Nwcml0ZUNhY2hlIH0gZnJvbSBcIi4vU1ZHU3ByaXRlQ2FjaGVcIjtcblxuLyoqXG4gKiDlm77pm4bmnaHnm67mjqXlj6NcbiAqL1xuaW50ZXJmYWNlIEF0bGFzRW50cnkge1xuICAgIHN2Z0NvbnRlbnQ6IHN0cmluZztcbiAgICB1dlJlY3Q6IFJlY3Q7IC8vIFVW5Z2Q5qCH77yIMC0x6IyD5Zu077yJXG4gICAgcGl4ZWxSZWN0OiBSZWN0OyAvLyDlg4/ntKDlnZDmoIdcbiAgICBzaXplOiBWZWMyOyAvLyDljp/lp4vlsLrlr7hcbn1cblxuLyoqXG4gKiDlm77pm4bmmKDlsITmjqXlj6NcbiAqL1xuaW50ZXJmYWNlIEF0bGFzTWFwcGluZyB7XG4gICAgYXRsYXNOYW1lOiBzdHJpbmc7XG4gICAgZW50cnlLZXk6IHN0cmluZztcbn1cblxuLyoqXG4gKiDlm77pm4bmlbDmja7mjqXlj6NcbiAqL1xuaW50ZXJmYWNlIEF0bGFzRGF0YSB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHRleHR1cmU6IFRleHR1cmUyRDtcbiAgICBzcHJpdGVGcmFtZTogU3ByaXRlRnJhbWU7XG4gICAgc3ZnRW50cmllczogTWFwPHN0cmluZywgQXRsYXNFbnRyeT47XG4gICAgdXNlZFNwYWNlOiBudW1iZXI7IC8vIOW3suS9v+eUqOepuumXtOavlOS+i++8iDAtMe+8iVxuICAgIHdpZHRoOiBudW1iZXI7XG4gICAgaGVpZ2h0OiBudW1iZXI7XG59XG5cbi8qKlxuICogU1ZH5Zu+6ZuG5p6E5bu65ZmoXG4gKiDlsIblpJrkuKpTVkfmiZPljIXliLDljZXkuKrnurnnkIblm77pm4bkuK3vvIzlh4/lsJHnurnnkIbliIfmjaLlvIDplIBcbiAqL1xuQGNjY2xhc3MoXCJTVkdBdGxhc0J1aWxkZXJcIilcbkBpY29uKFwiLi4vLi4vSW5rcGVuLnBuZ1wiKVxuQG1lbnUoXCIyRC9TVkdBdGxhc0J1aWxkZXJcIilcbkBleGVjdXRlSW5FZGl0TW9kZVxuZXhwb3J0IGNsYXNzIFNWR0F0bGFzQnVpbGRlciBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLy8gPT09PT09PT09PSDlm77pm4bphY3nva4gPT09PT09PT09PVxuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlm77pm4bmnIDlpKflrr3luqZcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5pyA5aSn5a695bqmXCIsXG4gICAgICAgIG1pbjogNjQsXG4gICAgICAgIG1heDogNDA5NixcbiAgICB9KVxuICAgIHByaXZhdGUgbWF4QXRsYXNXaWR0aDogbnVtYmVyID0gMTAyNDtcblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi5Zu+6ZuG5pyA5aSn6auY5bqmXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuacgOWkp+mrmOW6plwiLFxuICAgICAgICBtaW46IDY0LFxuICAgICAgICBtYXg6IDQwOTYsXG4gICAgfSlcbiAgICBwcml2YXRlIG1heEF0bGFzSGVpZ2h0OiBudW1iZXIgPSAxMDI0O1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLnurnnkIbpl7Tot53vvIjlg4/ntKDvvIlcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi57q555CG6Ze06LedXCIsXG4gICAgICAgIG1pbjogMCxcbiAgICAgICAgbWF4OiAzMixcbiAgICB9KVxuICAgIHByaXZhdGUgcGFkZGluZzogbnVtYmVyID0gMjtcblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So6Ieq5Yqo5Zu+6ZuG5p6E5bu6XCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuiHquWKqOaehOW7ulwiLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBlbmFibGVBdXRvQXRsYXM6IGJvb2xlYW4gPSB0cnVlO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlm77pm4bmnoTlu7rpmIjlgLzvvIhTVkfmlbDph4/vvIlcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5p6E5bu66ZiI5YC8XCIsXG4gICAgICAgIG1pbjogMixcbiAgICAgICAgbWF4OiAxMDAsXG4gICAgfSlcbiAgICBwcml2YXRlIGJ1aWxkVGhyZXNob2xkOiBudW1iZXIgPSAxMDtcblxuICAgIC8vID09PT09PT09PT0g5oCn6IO96YWN572uID09PT09PT09PT1cblxuICAgIEBwcm9wZXJ0eSh7XG4gICAgICAgIHRvb2x0aXA6IFwi5ZCv55So6L+Q6KGM5pe25Zu+6ZuG5pu05pawXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIui/kOihjOaXtuabtOaWsFwiLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBlbmFibGVSdW50aW1lVXBkYXRlczogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLmnIDlpKflm77pm4bmlbDph49cIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5pyA5aSn5Zu+6ZuG5pWwXCIsXG4gICAgICAgIG1pbjogMSxcbiAgICAgICAgbWF4OiAxMCxcbiAgICB9KVxuICAgIHByaXZhdGUgbWF4QXRsYXNlczogbnVtYmVyID0gMztcblxuICAgIC8vID09PT09PT09PT0g5YaF6YOo54q25oCBID09PT09PT09PT1cblxuICAgIHByaXZhdGUgYXRsYXNlczogTWFwPHN0cmluZywgQXRsYXNEYXRhPiA9IG5ldyBNYXAoKTsgLy8g5Zu+6ZuG5ZCN56ewIC0+IOWbvumbhuaVsOaNrlxuICAgIHByaXZhdGUgc3ZnVG9BdGxhc01hcHBpbmc6IE1hcDxzdHJpbmcsIEF0bGFzTWFwcGluZz4gPSBuZXcgTWFwKCk7IC8vIFNWR+WGheWuuSAtPiDlm77pm4bmmKDlsIRcbiAgICBwcml2YXRlIHBlbmRpbmdTVkdzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTsgLy8g5b6F5aSE55CGU1ZHXG5cbiAgICAvLyA9PT09PT09PT09IOeUn+WRveWRqOacn+aWueazlSA9PT09PT09PT09XG5cbiAgICBvbkxvYWQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUF0bGFzQnVpbGRlcigpO1xuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5jbGVhbnVwQXRsYXNCdWlsZGVyKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGRlbHRhVGltZTogbnVtYmVyKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUF1dG9BdGxhcyAmJiB0aGlzLnBlbmRpbmdTVkdzLnNpemUgPj0gdGhpcy5idWlsZFRocmVzaG9sZCkge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzUGVuZGluZ1NWR3MoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vID09PT09PT09PT0g5YWs5YWx5pa55rOVID09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIOa3u+WKoFNWR+WIsOWbvumbhuaehOW7uumYn+WIl1xuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuuVxuICAgICAqIEBwYXJhbSB3aWR0aCDlrr3luqZcbiAgICAgKiBAcGFyYW0gaGVpZ2h0IOmrmOW6plxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcbiAgICAgKi9cbiAgICBwdWJsaWMgYWRkU1ZHVG9BdGxhcyhzdmdDb250ZW50OiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmdlbmVyYXRlU1ZHS2V5KHN2Z0NvbnRlbnQsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKTtcblxuICAgICAgICBpZiAoIXRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuaGFzKGtleSkpIHtcbiAgICAgICAgICAgIHRoaXMucGVuZGluZ1NWR3MuYWRkKGtleSk7XG5cbiAgICAgICAgICAgIC8vIOWmguaenOWQr+eUqOS6huiHquWKqOaehOW7uuS4lOi+vuWIsOmYiOWAvO+8jOeri+WNs+WkhOeQhlxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQXV0b0F0bGFzICYmIHRoaXMucGVuZGluZ1NWR3Muc2l6ZSA+PSB0aGlzLmJ1aWxkVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUGVuZGluZ1NWR3MoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPllNWR+eahOWbvumbhueyvueBteW4p1xuICAgICAqIEBwYXJhbSBzdmdDb250ZW50IFNWR+WGheWuuVxuICAgICAqIEBwYXJhbSB3aWR0aCDlrr3luqZcbiAgICAgKiBAcGFyYW0gaGVpZ2h0IOmrmOW6plxuICAgICAqIEBwYXJhbSBjb2xvciDpopzoibLvvIjlj6/pgInvvIlcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlPFNwcml0ZUZyYW1lPiDov5Tlm57lm77pm4bkuK3nmoTnsr7ngbXluKdcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgZ2V0U1ZHRnJvbUF0bGFzKHN2Z0NvbnRlbnQ6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIGNvbG9yPzogc3RyaW5nKTogUHJvbWlzZTxTcHJpdGVGcmFtZSB8IG51bGw+IHtcbiAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5nZW5lcmF0ZVNWR0tleShzdmdDb250ZW50LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcik7XG5cbiAgICAgICAgLy8g5qOA5p+l5piv5ZCm5bey5Zyo5Zu+6ZuG5LitXG4gICAgICAgIGNvbnN0IG1hcHBpbmcgPSB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmdldChrZXkpO1xuICAgICAgICBpZiAobWFwcGluZykge1xuICAgICAgICAgICAgY29uc3QgYXRsYXMgPSB0aGlzLmF0bGFzZXMuZ2V0KG1hcHBpbmcuYXRsYXNOYW1lKTtcbiAgICAgICAgICAgIGlmIChhdGxhcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhdGxhcy5zcHJpdGVGcmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWmguaenOS4jeWcqOWbvumbhuS4reS4lOWQr+eUqOS6hui/kOihjOaXtuabtOaWsO+8jOWwneivlea3u+WKoOWIsOWbvumbhlxuICAgICAgICBpZiAodGhpcy5lbmFibGVSdW50aW1lVXBkYXRlcykge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5hZGRTVkdUb0F0bGFzQW5kQnVpbGQoc3ZnQ29udGVudCwgd2lkdGgsIGhlaWdodCwgY29sb3IpO1xuXG4gICAgICAgICAgICAvLyDph43mlrDmo4Dmn6VcbiAgICAgICAgICAgIGNvbnN0IG5ld01hcHBpbmcgPSB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmdldChrZXkpO1xuICAgICAgICAgICAgaWYgKG5ld01hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhcyA9IHRoaXMuYXRsYXNlcy5nZXQobmV3TWFwcGluZy5hdGxhc05hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChhdGxhcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYXRsYXMuc3ByaXRlRnJhbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5omL5Yqo5p6E5bu65Zu+6ZuGXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnRzIFNWR+WGheWuueaVsOe7hO+8iOW4puWwuuWvuOWSjOminOiJsu+8iVxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBidWlsZEF0bGFzKFxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xuICAgICAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICAgICAgd2lkdGg6IG51bWJlcjtcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xuICAgICAgICAgICAgY29sb3I/OiBzdHJpbmc7XG4gICAgICAgIH0+XG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XG4gICAgICAgIGlmIChzdmdDb250ZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuayoeaciVNWR+WGheWuueWPr+aehOW7uuWbvumbhlwiKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOajgOafpeWbvumbhuaVsOmHj+mZkOWItlxuICAgICAgICAgICAgaWYgKHRoaXMuYXRsYXNlcy5zaXplID49IHRoaXMubWF4QXRsYXNlcykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuW3sui+vuWIsOacgOWkp+WbvumbhuaVsOmHj+mZkOWItlwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tZXJnZU9yUmVwbGFjZUF0bGFzKHN2Z0NvbnRlbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g5Yib5bu65paw5Zu+6ZuGXG4gICAgICAgICAgICBjb25zdCBhdGxhc05hbWUgPSBgYXRsYXNfJHtEYXRlLm5vdygpfWA7XG4gICAgICAgICAgICBjb25zdCBhdGxhc0RhdGEgPSBhd2FpdCB0aGlzLmNyZWF0ZUF0bGFzKGF0bGFzTmFtZSwgc3ZnQ29udGVudHMpO1xuXG4gICAgICAgICAgICBpZiAoYXRsYXNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdGxhc2VzLnNldChhdGxhc05hbWUsIGF0bGFzRGF0YSk7XG5cbiAgICAgICAgICAgICAgICAvLyDmm7TmlrDmmKDlsIRcbiAgICAgICAgICAgICAgICBzdmdDb250ZW50cy5mb3JFYWNoKChzdmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gdGhpcy5nZW5lcmF0ZVNWR0tleShzdmcuY29udGVudCwgc3ZnLndpZHRoLCBzdmcuaGVpZ2h0LCBzdmcuY29sb3IpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLnNldChrZXksIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF0bGFzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudHJ5S2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOWbvumbhuaehOW7uuWujOaIkDogJHthdGxhc05hbWV9LCDljIXlkKsgJHtzdmdDb250ZW50cy5sZW5ndGh9IOS4qlNWR2ApO1xuICAgICAgICAgICAgICAgIHJldHVybiBhdGxhc0RhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIuaehOW7uuWbvumbhuWksei0pTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDojrflj5bmiYDmnInlm77pm4bkv6Hmga9cbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0QWxsQXRsYXNJbmZvKCk6IEFycmF5PHtcbiAgICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgICBzdmdDb3VudDogbnVtYmVyO1xuICAgICAgICB3aWR0aDogbnVtYmVyO1xuICAgICAgICBoZWlnaHQ6IG51bWJlcjtcbiAgICAgICAgdXNlZFNwYWNlOiBudW1iZXI7XG4gICAgfT4ge1xuICAgICAgICBjb25zdCBpbmZvOiBBcnJheTx7XG4gICAgICAgICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICAgICAgICBzdmdDb3VudDogbnVtYmVyO1xuICAgICAgICAgICAgd2lkdGg6IG51bWJlcjtcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xuICAgICAgICAgICAgdXNlZFNwYWNlOiBudW1iZXI7XG4gICAgICAgIH0+ID0gW107XG5cbiAgICAgICAgdGhpcy5hdGxhc2VzLmZvckVhY2goKGF0bGFzLCBuYW1lKSA9PiB7XG4gICAgICAgICAgICBpbmZvLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgc3ZnQ291bnQ6IGF0bGFzLnN2Z0VudHJpZXMuc2l6ZSxcbiAgICAgICAgICAgICAgICB3aWR0aDogYXRsYXMud2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBhdGxhcy5oZWlnaHQsXG4gICAgICAgICAgICAgICAgdXNlZFNwYWNlOiBhdGxhcy51c2VkU3BhY2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGluZm87XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5riF6Zmk5oyH5a6a5Zu+6ZuGXG4gICAgICogQHBhcmFtIGF0bGFzTmFtZSDlm77pm4blkI3np7BcbiAgICAgKi9cbiAgICBwdWJsaWMgY2xlYXJBdGxhcyhhdGxhc05hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBhdGxhcyA9IHRoaXMuYXRsYXNlcy5nZXQoYXRsYXNOYW1lKTtcbiAgICAgICAgaWYgKGF0bGFzKSB7XG4gICAgICAgICAgICAvLyDph4rmlL7nurnnkIbotYTmupBcbiAgICAgICAgICAgIGlmIChhdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgYXRsYXMudGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOenu+mZpOaYoOWwhFxuICAgICAgICAgICAgYXRsYXMuc3ZnRW50cmllcy5mb3JFYWNoKChlbnRyeSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdmdUb0F0bGFzTWFwcGluZy5kZWxldGUoa2V5KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyDnp7vpmaTlm77pm4ZcbiAgICAgICAgICAgIHRoaXMuYXRsYXNlcy5kZWxldGUoYXRsYXNOYW1lKTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coYOW3sua4hemZpOWbvumbhjogJHthdGxhc05hbWV9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmuIXpmaTmiYDmnInlm77pm4ZcbiAgICAgKi9cbiAgICBwdWJsaWMgY2xlYXJBbGxBdGxhc2VzKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmF0bGFzZXMuZm9yRWFjaCgoYXRsYXMsIG5hbWUpID0+IHtcbiAgICAgICAgICAgIGlmIChhdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgYXRsYXMudGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYXRsYXNlcy5jbGVhcigpO1xuICAgICAgICB0aGlzLnN2Z1RvQXRsYXNNYXBwaW5nLmNsZWFyKCk7XG4gICAgICAgIHRoaXMucGVuZGluZ1NWR3MuY2xlYXIoKTtcblxuICAgICAgICBjb25zb2xlLmxvZyhcIuW3sua4hemZpOaJgOacieWbvumbhlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDkvJjljJblm77pm4bnqbrpl7Tkvb/nlKhcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgb3B0aW1pemVBdGxhc2VzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBvcHRpbWl6YXRpb25Qcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICAgICAgdGhpcy5hdGxhc2VzLmZvckVhY2goKGF0bGFzLCBuYW1lKSA9PiB7XG4gICAgICAgICAgICBpZiAoYXRsYXMudXNlZFNwYWNlIDwgMC42KSB7XG4gICAgICAgICAgICAgICAgLy8g56m66Ze05L2/55So546H5L2O5LqONjAlXG4gICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uUHJvbWlzZXMucHVzaCh0aGlzLm9wdGltaXplQXRsYXMobmFtZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChvcHRpbWl6YXRpb25Qcm9taXNlcyk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PSDnp4HmnInmlrnms5UgPT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog5Yid5aeL5YyW5Zu+6ZuG5p6E5bu65ZmoXG4gICAgICovXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplQXRsYXNCdWlsZGVyKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmF0bGFzZXMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5zdmdUb0F0bGFzTWFwcGluZy5jbGVhcigpO1xuICAgICAgICB0aGlzLnBlbmRpbmdTVkdzLmNsZWFyKCk7XG5cbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdBdGxhc0J1aWxkZXIg5Yid5aeL5YyW5a6M5oiQXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOa4heeQhuWbvumbhuaehOW7uuWZqFxuICAgICAqL1xuICAgIHByaXZhdGUgY2xlYW51cEF0bGFzQnVpbGRlcigpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jbGVhckFsbEF0bGFzZXMoKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdBdGxhc0J1aWxkZXIg5riF55CG5a6M5oiQXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOeUn+aIkFNWR+mUrlxuICAgICAqL1xuICAgIHByaXZhdGUgZ2VuZXJhdGVTVkdLZXkoc3ZnQ29udGVudDogc3RyaW5nLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgY29sb3I/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBjb2xvclBhcnQgPSBjb2xvciB8fCBcImRlZmF1bHRcIjtcbiAgICAgICAgY29uc3QgaGFzaCA9IHRoaXMuY2FsY3VsYXRlU2ltcGxlSGFzaChzdmdDb250ZW50KTtcbiAgICAgICAgcmV0dXJuIGAke2hhc2h9XyR7d2lkdGh9eCR7aGVpZ2h0fV8ke2NvbG9yUGFydH1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuoeeul+eugOWNleWTiOW4jFxuICAgICAqL1xuICAgIHByaXZhdGUgY2FsY3VsYXRlU2ltcGxlSGFzaChzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGxldCBoYXNoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBjaGFyO1xuICAgICAgICAgICAgaGFzaCA9IGhhc2ggJiBoYXNoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBNYXRoLmFicyhoYXNoKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDAsIDgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOWkhOeQhuW+heWkhOeQhlNWR1xuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcHJvY2Vzc1BlbmRpbmdTVkdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5wZW5kaW5nU1ZHcy5zaXplID09PSAwKSByZXR1cm47XG5cbiAgICAgICAgLy8g5pS26ZuG5b6F5aSE55CGU1ZH55qE6K+m57uG5L+h5oGvXG4gICAgICAgIGNvbnN0IHN2Z0RldGFpbHM6IEFycmF5PHtcbiAgICAgICAgICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XG4gICAgICAgICAgICBoZWlnaHQ6IG51bWJlcjtcbiAgICAgICAgICAgIGNvbG9yPzogc3RyaW5nO1xuICAgICAgICB9PiA9IFtdO1xuXG4gICAgICAgIC8vIOi/memHjOmcgOimgeS7jnBlbmRpbmdTVkdz5Lit5o+Q5Y+W5a6e6ZmFU1ZH5YaF5a65XG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muS9v+eUqOWNoOS9jeesplxuICAgICAgICB0aGlzLnBlbmRpbmdTVkdzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgICAgLy8g6Kej5p6Q6ZSu6I635Y+W5bC65a+4562J5L+h5oGvXG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IGtleS5tYXRjaCgvKC4rKV8oXFxkKyl4KFxcZCspXyguKykvKTtcbiAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IFssIGhhc2gsIHdpZHRoU3RyLCBoZWlnaHRTdHIsIGNvbG9yXSA9IG1hdGNoO1xuICAgICAgICAgICAgICAgIHN2Z0RldGFpbHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGBzdmdfaGFzaF8ke2hhc2h9YCwgLy8g566A5YyW77ya5a6e6ZmF5bqU6K+l5a2Y5YKoU1ZH5YaF5a65XG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiBwYXJzZUludCh3aWR0aFN0ciksXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogcGFyc2VJbnQoaGVpZ2h0U3RyKSxcbiAgICAgICAgICAgICAgICAgICAgY29sb3I6IGNvbG9yICE9PSBcImRlZmF1bHRcIiA/IGNvbG9yIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoc3ZnRGV0YWlscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmJ1aWxkQXRsYXMoc3ZnRGV0YWlscyk7XG4gICAgICAgICAgICB0aGlzLnBlbmRpbmdTVkdzLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmt7vliqBTVkfliLDlm77pm4blubbmnoTlu7pcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFkZFNWR1RvQXRsYXNBbmRCdWlsZChzdmdDb250ZW50OiBzdHJpbmcsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBjb2xvcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBrZXkgPSB0aGlzLmdlbmVyYXRlU1ZHS2V5KHN2Z0NvbnRlbnQsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKTtcblxuICAgICAgICAvLyDmo4Dmn6XmmK/lkKbmnInnqbrpl7TotrPlpJ/nmoTnjrDmnInlm77pm4ZcbiAgICAgICAgY29uc3Qgc3VpdGFibGVBdGxhcyA9IHRoaXMuZmluZFN1aXRhYmxlQXRsYXMod2lkdGgsIGhlaWdodCk7XG4gICAgICAgIGlmIChzdWl0YWJsZUF0bGFzKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZFRvRXhpc3RpbmdBdGxhcyhzdWl0YWJsZUF0bGFzLm5hbWUsIHN2Z0NvbnRlbnQsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOWIm+W7uuaWsOWbvumbhlxuICAgICAgICAgICAgYXdhaXQgdGhpcy5idWlsZEF0bGFzKFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHN2Z0NvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoLFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOafpeaJvuWQiOmAgueahOeOsOacieWbvumbhlxuICAgICAqL1xuICAgIHByaXZhdGUgZmluZFN1aXRhYmxlQXRsYXMod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBBdGxhc0RhdGEgfCBudWxsIHtcbiAgICAgICAgbGV0IGJlc3RBdGxhczogQXRsYXNEYXRhIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGxldCBiZXN0U3BhY2VVc2FnZSA9IEluZmluaXR5O1xuXG4gICAgICAgIHRoaXMuYXRsYXNlcy5mb3JFYWNoKChhdGxhcykgPT4ge1xuICAgICAgICAgICAgLy8g5qOA5p+l5Zu+6ZuG5piv5ZCm5pyJ6Laz5aSf56m66Ze0XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgYXRsYXMudXNlZFNwYWNlIDwgMC45ICYmIC8vIOS9v+eUqOeOh+S9juS6jjkwJVxuICAgICAgICAgICAgICAgIHdpZHRoIDw9IGF0bGFzLndpZHRoICogKDEgLSBhdGxhcy51c2VkU3BhY2UpICYmXG4gICAgICAgICAgICAgICAgaGVpZ2h0IDw9IGF0bGFzLmhlaWdodCAqICgxIC0gYXRsYXMudXNlZFNwYWNlKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgLy8g6YCJ5oup56m66Ze05L2/55So546H5pyA6auY55qE5Zu+6ZuG77yI5pyA5ruh5L2G5LuN5pyJ56m66Ze077yJXG4gICAgICAgICAgICAgICAgY29uc3Qgc3BhY2VMZWZ0ID0gMSAtIGF0bGFzLnVzZWRTcGFjZTtcbiAgICAgICAgICAgICAgICBpZiAoc3BhY2VMZWZ0IDwgYmVzdFNwYWNlVXNhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgYmVzdFNwYWNlVXNhZ2UgPSBzcGFjZUxlZnQ7XG4gICAgICAgICAgICAgICAgICAgIGJlc3RBdGxhcyA9IGF0bGFzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJlc3RBdGxhcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmt7vliqDliLDnjrDmnInlm77pm4ZcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFkZFRvRXhpc3RpbmdBdGxhcyhcbiAgICAgICAgYXRsYXNOYW1lOiBzdHJpbmcsXG4gICAgICAgIHN2Z0NvbnRlbnQ6IHN0cmluZyxcbiAgICAgICAgd2lkdGg6IG51bWJlcixcbiAgICAgICAgaGVpZ2h0OiBudW1iZXIsXG4gICAgICAgIGNvbG9yPzogc3RyaW5nXG4gICAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IGF0bGFzID0gdGhpcy5hdGxhc2VzLmdldChhdGxhc05hbWUpO1xuICAgICAgICBpZiAoIWF0bGFzKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOi/memHjOW6lOivpeWunueOsOWunumZheeahOWbvumbhuabtOaWsOmAu+i+kVxuICAgICAgICAgICAgLy8g566A5YyW5a6e546w77ya6YeN5paw5p6E5bu65pW05Liq5Zu+6ZuGXG4gICAgICAgICAgICBjb25zdCBhbGxFbnRyaWVzID0gQXJyYXkuZnJvbShhdGxhcy5zdmdFbnRyaWVzLnZhbHVlcygpKS5tYXAoKGVudHJ5KSA9PiAoe1xuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGVudHJ5LnN2Z0NvbnRlbnQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IGVudHJ5LnNpemUueCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IGVudHJ5LnNpemUueSxcbiAgICAgICAgICAgICAgICBjb2xvcjogdGhpcy5leHRyYWN0Q29sb3JGcm9tU1ZHKGVudHJ5LnN2Z0NvbnRlbnQpLFxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAvLyDmt7vliqDmlrDmnaHnm65cbiAgICAgICAgICAgIGFsbEVudHJpZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgY29udGVudDogc3ZnQ29udGVudCxcbiAgICAgICAgICAgICAgICB3aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQsXG4gICAgICAgICAgICAgICAgY29sb3IsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8g6YeN5paw5p6E5bu65Zu+6ZuGXG4gICAgICAgICAgICBjb25zdCBuZXdBdGxhcyA9IGF3YWl0IHRoaXMuY3JlYXRlQXRsYXMoYCR7YXRsYXNOYW1lfV91cGRhdGVkYCwgYWxsRW50cmllcyk7XG4gICAgICAgICAgICBpZiAobmV3QXRsYXMpIHtcbiAgICAgICAgICAgICAgICAvLyDmm7/mjaLml6flm77pm4ZcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQXRsYXMoYXRsYXNOYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLmF0bGFzZXMuc2V0KGAke2F0bGFzTmFtZX1fdXBkYXRlZGAsIG5ld0F0bGFzKTtcblxuICAgICAgICAgICAgICAgIC8vIOabtOaWsOaYoOWwhFxuICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHRoaXMuZ2VuZXJhdGVTVkdLZXkoc3ZnQ29udGVudCwgd2lkdGgsIGhlaWdodCwgY29sb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuc2V0KGtleSwge1xuICAgICAgICAgICAgICAgICAgICBhdGxhc05hbWU6IGAke2F0bGFzTmFtZX1fdXBkYXRlZGAsXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5S2V5OiBrZXksXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIua3u+WKoOWIsOeOsOacieWbvumbhuWksei0pTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5LuOU1ZH5o+Q5Y+W6aKc6ImyXG4gICAgICovXG4gICAgcHJpdmF0ZSBleHRyYWN0Q29sb3JGcm9tU1ZHKHN2Z0NvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNvbG9yTWF0Y2ggPSBzdmdDb250ZW50Lm1hdGNoKC9maWxsPVwiKFteXCJdKilcIi8pO1xuICAgICAgICBpZiAoY29sb3JNYXRjaCAmJiBjb2xvck1hdGNoWzFdICE9PSBcIm5vbmVcIiAmJiBjb2xvck1hdGNoWzFdICE9PSBcInRyYW5zcGFyZW50XCIpIHtcbiAgICAgICAgICAgIHJldHVybiBjb2xvck1hdGNoWzFdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5Yib5bu65Zu+6ZuGXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBdGxhcyhcbiAgICAgICAgbmFtZTogc3RyaW5nLFxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xuICAgICAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICAgICAgd2lkdGg6IG51bWJlcjtcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xuICAgICAgICAgICAgY29sb3I/OiBzdHJpbmc7XG4gICAgICAgIH0+XG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XG4gICAgICAgIGlmIChzdmdDb250ZW50cy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDorqHnrpflm77pm4blsLrlr7hcbiAgICAgICAgICAgIGNvbnN0IGF0bGFzU2l6ZSA9IHRoaXMuY2FsY3VsYXRlQXRsYXNTaXplKHN2Z0NvbnRlbnRzKTtcbiAgICAgICAgICAgIGlmIChhdGxhc1NpemUud2lkdGggPT09IDAgfHwgYXRsYXNTaXplLmhlaWdodCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDliJvlu7pDYW52YXNcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XG4gICAgICAgICAgICBjYW52YXMud2lkdGggPSBhdGxhc1NpemUud2lkdGg7XG4gICAgICAgICAgICBjYW52YXMuaGVpZ2h0ID0gYXRsYXNTaXplLmhlaWdodDtcblxuICAgICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICAgICAgICAgIGlmICghY3R4KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5peg5rOV6I635Y+WQ2FudmFzIDJE5LiK5LiL5paHXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDmuIXnqbrnlLvluINcbiAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8g55+p5b2i5YyF6KOF566X5rOV77yI566A5YyW77ya566A5Y2V572R5qC85biD5bGA77yJXG4gICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gbmV3IE1hcDxzdHJpbmcsIEF0bGFzRW50cnk+KCk7XG4gICAgICAgICAgICBjb25zdCBjZWxsU2l6ZSA9IHRoaXMuY2FsY3VsYXRlQ2VsbFNpemUoc3ZnQ29udGVudHMpO1xuICAgICAgICAgICAgY29uc3QgY29scyA9IE1hdGguZmxvb3IoYXRsYXNTaXplLndpZHRoIC8gY2VsbFNpemUpO1xuICAgICAgICAgICAgY29uc3Qgcm93cyA9IE1hdGguY2VpbChzdmdDb250ZW50cy5sZW5ndGggLyBjb2xzKTtcblxuICAgICAgICAgICAgbGV0IGluZGV4ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ZnIG9mIHN2Z0NvbnRlbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID49IGNvbHMgKiByb3dzKSBicmVhaztcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbCA9IGluZGV4ICUgY29scztcbiAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBNYXRoLmZsb29yKGluZGV4IC8gY29scyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB4ID0gY29sICogY2VsbFNpemUgKyB0aGlzLnBhZGRpbmc7XG4gICAgICAgICAgICAgICAgY29uc3QgeSA9IHJvdyAqIGNlbGxTaXplICsgdGhpcy5wYWRkaW5nO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5V2lkdGggPSBjZWxsU2l6ZSAtIHRoaXMucGFkZGluZyAqIDI7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50cnlIZWlnaHQgPSBjZWxsU2l6ZSAtIHRoaXMucGFkZGluZyAqIDI7XG5cbiAgICAgICAgICAgICAgICAvLyDojrflj5ZTVkfnsr7ngbXluKdcbiAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IGF3YWl0IFNWR1Nwcml0ZUNhY2hlLmdldFNWR1Nwcml0ZUZyYW1lKHN2Zy5jb250ZW50LCBlbnRyeVdpZHRoLCBlbnRyeUhlaWdodCwgc3ZnLmNvbG9yKTtcblxuICAgICAgICAgICAgICAgIC8vIOi/memHjOW6lOivpeWwhlNWR+e7mOWItuWIsENhbnZhc+eahOWvueW6lOS9jee9rlxuICAgICAgICAgICAgICAgIC8vIOeugOWMluWunueOsO+8mue7mOWItuS4gOS4quWNoOS9jeefqeW9olxuICAgICAgICAgICAgICAgIGN0eC5maWxsU3R5bGUgPSBcInJnYmEoMTAwLCAxMDAsIDEwMCwgMC41KVwiO1xuICAgICAgICAgICAgICAgIGN0eC5maWxsUmVjdCh4LCB5LCBlbnRyeVdpZHRoLCBlbnRyeUhlaWdodCk7XG5cbiAgICAgICAgICAgICAgICAvLyDliJvlu7rlm77pm4bmnaHnm65cbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyeUtleSA9IHRoaXMuZ2VuZXJhdGVTVkdLZXkoc3ZnLmNvbnRlbnQsIHN2Zy53aWR0aCwgc3ZnLmhlaWdodCwgc3ZnLmNvbG9yKTtcbiAgICAgICAgICAgICAgICBlbnRyaWVzLnNldChlbnRyeUtleSwge1xuICAgICAgICAgICAgICAgICAgICBzdmdDb250ZW50OiBzdmcuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgdXZSZWN0OiBuZXcgUmVjdChcbiAgICAgICAgICAgICAgICAgICAgICAgIHggLyBhdGxhc1NpemUud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICB5IC8gYXRsYXNTaXplLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVudHJ5V2lkdGggLyBhdGxhc1NpemUud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRyeUhlaWdodCAvIGF0bGFzU2l6ZS5oZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgcGl4ZWxSZWN0OiBuZXcgUmVjdCh4LCB5LCBlbnRyeVdpZHRoLCBlbnRyeUhlaWdodCksXG4gICAgICAgICAgICAgICAgICAgIHNpemU6IG5ldyBWZWMyKHN2Zy53aWR0aCwgc3ZnLmhlaWdodCksXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDliJvlu7rnurnnkIZcbiAgICAgICAgICAgIGNvbnN0IGltYWdlQXNzZXQgPSBuZXcgSW1hZ2VBc3NldChjYW52YXMpO1xuICAgICAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlMkQoKTtcbiAgICAgICAgICAgIHRleHR1cmUuaW1hZ2UgPSBpbWFnZUFzc2V0O1xuXG4gICAgICAgICAgICAvLyDliJvlu7rnsr7ngbXluKdcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gbmV3IFNwcml0ZUZyYW1lKCk7XG4gICAgICAgICAgICBzcHJpdGVGcmFtZS50ZXh0dXJlID0gdGV4dHVyZTtcblxuICAgICAgICAgICAgLy8g6K6h566X56m66Ze05L2/55So546HXG4gICAgICAgICAgICBjb25zdCB0b3RhbENlbGxzID0gY29scyAqIHJvd3M7XG4gICAgICAgICAgICBjb25zdCB1c2VkQ2VsbHMgPSBNYXRoLm1pbihzdmdDb250ZW50cy5sZW5ndGgsIHRvdGFsQ2VsbHMpO1xuICAgICAgICAgICAgY29uc3QgdXNlZFNwYWNlID0gKHVzZWRDZWxscyAqIGNlbGxTaXplICogY2VsbFNpemUpIC8gKGF0bGFzU2l6ZS53aWR0aCAqIGF0bGFzU2l6ZS5oZWlnaHQpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgdGV4dHVyZSxcbiAgICAgICAgICAgICAgICBzcHJpdGVGcmFtZSxcbiAgICAgICAgICAgICAgICBzdmdFbnRyaWVzOiBlbnRyaWVzLFxuICAgICAgICAgICAgICAgIHVzZWRTcGFjZSxcbiAgICAgICAgICAgICAgICB3aWR0aDogYXRsYXNTaXplLndpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogYXRsYXNTaXplLmhlaWdodCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi5Yib5bu65Zu+6ZuG5aSx6LSlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuoeeul+WbvumbhuWwuuWvuFxuICAgICAqL1xuICAgIHByaXZhdGUgY2FsY3VsYXRlQXRsYXNTaXplKFxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xuICAgICAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICAgICAgd2lkdGg6IG51bWJlcjtcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xuICAgICAgICAgICAgY29sb3I/OiBzdHJpbmc7XG4gICAgICAgIH0+XG4gICAgKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcbiAgICAgICAgaWYgKHN2Z0NvbnRlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g566A5Y2V6K6h566X77ya5Z+65LqOU1ZH5pWw6YeP5ZKM5pyA5aSn5bC65a+4XG4gICAgICAgIGNvbnN0IG1heFdpZHRoID0gTWF0aC5tYXgoLi4uc3ZnQ29udGVudHMubWFwKChzdmcpID0+IHN2Zy53aWR0aCkpO1xuICAgICAgICBjb25zdCBtYXhIZWlnaHQgPSBNYXRoLm1heCguLi5zdmdDb250ZW50cy5tYXAoKHN2ZykgPT4gc3ZnLmhlaWdodCkpO1xuXG4gICAgICAgIC8vIOiuoeeul+e9keagvOW4g+WxgFxuICAgICAgICBjb25zdCBjZWxsU2l6ZSA9IE1hdGgubWF4KG1heFdpZHRoLCBtYXhIZWlnaHQpICsgdGhpcy5wYWRkaW5nICogMjtcbiAgICAgICAgY29uc3Qgc3ZnQ291bnQgPSBzdmdDb250ZW50cy5sZW5ndGg7XG5cbiAgICAgICAgLy8g5Lyw566X5omA6ZyA6KGM5YiXXG4gICAgICAgIGNvbnN0IGVzdGltYXRlZENlbGxzID0gc3ZnQ291bnQ7XG4gICAgICAgIGNvbnN0IHNpZGUgPSBNYXRoLmNlaWwoTWF0aC5zcXJ0KGVzdGltYXRlZENlbGxzKSk7XG5cbiAgICAgICAgbGV0IHdpZHRoID0gTWF0aC5taW4oc2lkZSAqIGNlbGxTaXplLCB0aGlzLm1heEF0bGFzV2lkdGgpO1xuICAgICAgICBsZXQgaGVpZ2h0ID0gTWF0aC5taW4oc2lkZSAqIGNlbGxTaXplLCB0aGlzLm1heEF0bGFzSGVpZ2h0KTtcblxuICAgICAgICAvLyDnoa7kv53lsLrlr7jmmK8y55qE5bmC77yI57q555CG5LyY5YyW77yJXG4gICAgICAgIHdpZHRoID0gdGhpcy5uZXh0UG93ZXJPZlR3byh3aWR0aCk7XG4gICAgICAgIGhlaWdodCA9IHRoaXMubmV4dFBvd2VyT2ZUd28oaGVpZ2h0KTtcblxuICAgICAgICByZXR1cm4geyB3aWR0aCwgaGVpZ2h0IH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6K6h566X5Y2V5YWD5qC85bC65a+4XG4gICAgICovXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVDZWxsU2l6ZShcbiAgICAgICAgc3ZnQ29udGVudHM6IEFycmF5PHtcbiAgICAgICAgICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICAgICAgICAgIHdpZHRoOiBudW1iZXI7XG4gICAgICAgICAgICBoZWlnaHQ6IG51bWJlcjtcbiAgICAgICAgICAgIGNvbG9yPzogc3RyaW5nO1xuICAgICAgICB9PlxuICAgICk6IG51bWJlciB7XG4gICAgICAgIGlmIChzdmdDb250ZW50cy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuXG4gICAgICAgIC8vIOaJvuWIsOacgOWkp+WwuuWvuOW5tuWKoOS4inBhZGRpbmdcbiAgICAgICAgY29uc3QgbWF4V2lkdGggPSBNYXRoLm1heCguLi5zdmdDb250ZW50cy5tYXAoKHN2ZykgPT4gc3ZnLndpZHRoKSk7XG4gICAgICAgIGNvbnN0IG1heEhlaWdodCA9IE1hdGgubWF4KC4uLnN2Z0NvbnRlbnRzLm1hcCgoc3ZnKSA9PiBzdmcuaGVpZ2h0KSk7XG4gICAgICAgIGNvbnN0IG1heFNpemUgPSBNYXRoLm1heChtYXhXaWR0aCwgbWF4SGVpZ2h0KTtcblxuICAgICAgICByZXR1cm4gbWF4U2l6ZSArIHRoaXMucGFkZGluZyAqIDI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5LiL5LiA5LiqMueahOW5glxuICAgICAqL1xuICAgIHByaXZhdGUgbmV4dFBvd2VyT2ZUd28objogbnVtYmVyKTogbnVtYmVyIHtcbiAgICAgICAgbi0tO1xuICAgICAgICBuIHw9IG4gPj4gMTtcbiAgICAgICAgbiB8PSBuID4+IDI7XG4gICAgICAgIG4gfD0gbiA+PiA0O1xuICAgICAgICBuIHw9IG4gPj4gODtcbiAgICAgICAgbiB8PSBuID4+IDE2O1xuICAgICAgICBuKys7XG4gICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChuLCA2NCksIHRoaXMubWF4QXRsYXNXaWR0aCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5ZCI5bm25oiW5pu/5o2i5Zu+6ZuGXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBtZXJnZU9yUmVwbGFjZUF0bGFzKFxuICAgICAgICBzdmdDb250ZW50czogQXJyYXk8e1xuICAgICAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICAgICAgd2lkdGg6IG51bWJlcjtcbiAgICAgICAgICAgIGhlaWdodDogbnVtYmVyO1xuICAgICAgICAgICAgY29sb3I/OiBzdHJpbmc7XG4gICAgICAgIH0+XG4gICAgKTogUHJvbWlzZTxBdGxhc0RhdGEgfCBudWxsPiB7XG4gICAgICAgIC8vIOaJvuWIsOS9v+eUqOeOh+acgOS9jueahOWbvumbhlxuICAgICAgICBsZXQgbG93ZXN0VXNhZ2VBdGxhczogeyBuYW1lOiBzdHJpbmc7IHVzYWdlOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuYXRsYXNlcy5mb3JFYWNoKChhdGxhcywgbmFtZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFsb3dlc3RVc2FnZUF0bGFzIHx8IGF0bGFzLnVzZWRTcGFjZSA8IGxvd2VzdFVzYWdlQXRsYXMudXNhZ2UpIHtcbiAgICAgICAgICAgICAgICBsb3dlc3RVc2FnZUF0bGFzID0geyBuYW1lOiBuYW1lLCB1c2FnZTogYXRsYXMudXNlZFNwYWNlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChsb3dlc3RVc2FnZUF0bGFzKSB7XG4gICAgICAgICAgICAvLyDmuIXpmaTkvb/nlKjnjofmnIDkvY7nmoTlm77pm4ZcbiAgICAgICAgICAgIHRoaXMuY2xlYXJBdGxhcygobG93ZXN0VXNhZ2VBdGxhcyBhcyB7IG5hbWU6IHN0cmluZzsgdXNhZ2U6IG51bWJlciB9KS5uYW1lKTtcblxuICAgICAgICAgICAgLy8g5Yib5bu65paw5Zu+6ZuGXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5idWlsZEF0bGFzKHN2Z0NvbnRlbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOS8mOWMluaMh+WumuWbvumbhlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgb3B0aW1pemVBdGxhcyhhdGxhc05hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBhdGxhcyA9IHRoaXMuYXRsYXNlcy5nZXQoYXRsYXNOYW1lKTtcbiAgICAgICAgaWYgKCFhdGxhcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIOaUtumbhuaJgOacieadoeebrlxuICAgICAgICBjb25zdCBhbGxFbnRyaWVzID0gQXJyYXkuZnJvbShhdGxhcy5zdmdFbnRyaWVzLnZhbHVlcygpKS5tYXAoKGVudHJ5KSA9PiAoe1xuICAgICAgICAgICAgY29udGVudDogZW50cnkuc3ZnQ29udGVudCxcbiAgICAgICAgICAgIHdpZHRoOiBlbnRyeS5zaXplLngsXG4gICAgICAgICAgICBoZWlnaHQ6IGVudHJ5LnNpemUueSxcbiAgICAgICAgICAgIGNvbG9yOiB0aGlzLmV4dHJhY3RDb2xvckZyb21TVkcoZW50cnkuc3ZnQ29udGVudCksXG4gICAgICAgIH0pKTtcblxuICAgICAgICAvLyDph43mlrDmnoTlu7rlm77pm4bvvIjlj6/og73mm7TntKflh5HvvIlcbiAgICAgICAgY29uc3Qgb3B0aW1pemVkQXRsYXMgPSBhd2FpdCB0aGlzLmNyZWF0ZUF0bGFzKGAke2F0bGFzTmFtZX1fb3B0aW1pemVkYCwgYWxsRW50cmllcyk7XG4gICAgICAgIGlmIChvcHRpbWl6ZWRBdGxhcyAmJiBvcHRpbWl6ZWRBdGxhcy51c2VkU3BhY2UgPiBhdGxhcy51c2VkU3BhY2UpIHtcbiAgICAgICAgICAgIC8vIOabv+aNouaXp+WbvumbhlxuICAgICAgICAgICAgdGhpcy5jbGVhckF0bGFzKGF0bGFzTmFtZSk7XG4gICAgICAgICAgICB0aGlzLmF0bGFzZXMuc2V0KGAke2F0bGFzTmFtZX1fb3B0aW1pemVkYCwgb3B0aW1pemVkQXRsYXMpO1xuXG4gICAgICAgICAgICAvLyDmm7TmlrDmmKDlsIRcbiAgICAgICAgICAgIG9wdGltaXplZEF0bGFzLnN2Z0VudHJpZXMuZm9yRWFjaCgoZW50cnksIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ZnVG9BdGxhc01hcHBpbmcuc2V0KGtleSwge1xuICAgICAgICAgICAgICAgICAgICBhdGxhc05hbWU6IGAke2F0bGFzTmFtZX1fb3B0aW1pemVkYCxcbiAgICAgICAgICAgICAgICAgICAgZW50cnlLZXk6IGtleSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhg5Zu+6ZuG5LyY5YyW5a6M5oiQOiAke2F0bGFzTmFtZX0gLT4gJHthdGxhc05hbWV9X29wdGltaXplZGApO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19