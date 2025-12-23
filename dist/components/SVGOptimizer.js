"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGOptimizer = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, menu } = cc_1._decorator;
/**
 * SVG优化器
 * 提供各种SVG优化功能，如路径简化、颜色优化、压缩等
 */
let SVGOptimizer = class SVGOptimizer extends cc_1.Component {
    constructor() {
        // ========== 优化配置 ==========
        super(...arguments);
        this.enableAutoOptimization = true;
        this.optimizationConfig = {
            enablePathSimplification: true,
            pathSimplificationTolerance: 0.1,
            enableColorOptimization: true,
            maxColors: 16,
            enableCompression: true,
            compressionLevel: 6,
            removeMetadata: true,
            removeComments: true,
            removeUnusedDefs: true,
            mergePaths: true,
            precision: 3,
        };
        this.optimizationThreshold = 10; // 10KB
        this.batchOptimizationCount = 10;
        // ========== 性能配置 ==========
        this.enablePerformanceMonitoring = false;
        this.maxCachedResults = 100;
        // ========== 内部状态 ==========
        this.optimizationCache = new Map(); // 优化结果缓存
        this.pendingOptimizations = new Set(); // 待优化SVG
        this.optimizationQueue = []; // 优化队列
        this.performanceStats = {
            totalOptimizations: 0,
            totalReduction: 0,
            averageReduction: 0,
            totalTime: 0,
            averageTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
        };
    }
    // ========== 生命周期方法 ==========
    onLoad() {
        this.initializeOptimizer();
    }
    onDestroy() {
        this.cleanupOptimizer();
    }
    update(deltaTime) {
        if (this.enableAutoOptimization && this.pendingOptimizations.size > 0) {
            this.processPendingOptimizations();
        }
    }
    // ========== 公共方法 ==========
    /**
     * 优化SVG内容
     * @param svgContent SVG内容
     * @param config 优化配置（可选，使用默认配置）
     * @returns 优化后的SVG内容
     */
    async optimizeSVG(svgContent, config) {
        const cacheKey = this.generateCacheKey(svgContent, config || this.optimizationConfig);
        // 检查缓存
        if (this.optimizationCache.has(cacheKey)) {
            this.performanceStats.cacheHits++;
            const cachedResult = this.optimizationCache.get(cacheKey);
            // 更新缓存访问时间（LRU策略）
            this.optimizationCache.delete(cacheKey);
            this.optimizationCache.set(cacheKey, cachedResult);
            return this.applyOptimization(svgContent, cachedResult);
        }
        this.performanceStats.cacheMisses++;
        const startTime = Date.now();
        const originalSize = svgContent.length;
        try {
            // 执行优化
            const optimizedContent = await this.performOptimization(svgContent, config || this.optimizationConfig);
            const optimizedSize = optimizedContent.length;
            const reductionPercentage = ((originalSize - optimizedSize) / originalSize) * 100;
            const optimizationTime = Date.now() - startTime;
            const result = {
                originalSize,
                optimizedSize,
                reductionPercentage,
                optimizationTime,
                changes: this.getOptimizationChanges(svgContent, optimizedContent),
            };
            // 缓存结果
            this.cacheOptimizationResult(cacheKey, result);
            // 更新性能统计
            this.updatePerformanceStats(result);
            console.log(`SVG优化完成: 减少 ${reductionPercentage.toFixed(2)}% (${originalSize} -> ${optimizedSize} 字节)`);
            return optimizedContent;
        }
        catch (error) {
            console.error("SVG优化失败:", error);
            return svgContent; // 失败时返回原始内容
        }
    }
    /**
     * 批量优化SVG
     * @param svgContents SVG内容数组
     * @param config 优化配置（可选）
     * @returns 优化后的SVG内容数组
     */
    async batchOptimizeSVG(svgContents, config) {
        const promises = svgContents.map((svgContent) => this.optimizeSVG(svgContent, config));
        return Promise.all(promises);
    }
    /**
     * 优化精灵的SVG
     * @param sprite 精灵组件
     * @param config 优化配置（可选）
     */
    async optimizeSpriteSVG(sprite, config) {
        var _a;
        if (!sprite || !sprite.spriteFrame) {
            console.warn("精灵或精灵帧无效");
            return;
        }
        // 这里需要从精灵获取SVG内容
        // 简化实现：假设精灵有SVG内容属性
        const svgContent = this.extractSVGFromSprite(sprite);
        if (!svgContent) {
            console.warn("无法从精灵获取SVG内容");
            return;
        }
        // 优化SVG
        const optimizedContent = await this.optimizeSVG(svgContent, config);
        // 更新精灵（这里需要根据实际项目结构实现）
        // 简化实现：记录优化结果
        console.log(`精灵SVG优化完成: ${((_a = sprite.node) === null || _a === void 0 ? void 0 : _a.name) || "未知精灵"}`);
    }
    /**
     * 获取优化统计
     */
    getOptimizationStats() {
        return Object.assign({}, this.performanceStats);
    }
    /**
     * 清除优化缓存
     */
    clearOptimizationCache() {
        this.optimizationCache.clear();
        console.log("优化缓存已清除");
    }
    /**
     * 获取缓存信息
     */
    getCacheInfo() {
        const totalSize = Array.from(this.optimizationCache.values()).reduce((sum, result) => sum + result.optimizedSize, 0);
        const totalAccesses = this.performanceStats.cacheHits + this.performanceStats.cacheMisses;
        const hitRate = totalAccesses > 0 ? (this.performanceStats.cacheHits / totalAccesses) * 100 : 0;
        return {
            size: this.optimizationCache.size,
            hitRate,
            totalSize,
        };
    }
    /**
     * 设置优化配置
     * @param config 新的优化配置
     */
    setOptimizationConfig(config) {
        this.optimizationConfig = config;
        console.log("优化配置已更新");
        // 清除缓存，因为配置已更改
        this.clearOptimizationCache();
    }
    /**
     * 分析SVG优化潜力
     * @param svgContent SVG内容
     * @returns 优化潜力分析
     */
    analyzeOptimizationPotential(svgContent) {
        const size = svgContent.length;
        // 分析路径数量
        const pathCount = (svgContent.match(/<path/g) || []).length;
        // 分析颜色数量
        const colorMatches = svgContent.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g) || [];
        const colorCount = new Set(colorMatches).size;
        // 分析元数据大小
        const metadataSize = this.calculateMetadataSize(svgContent);
        // 分析注释大小
        const commentSize = this.calculateCommentSize(svgContent);
        // 估算潜在减少
        const potentialReduction = this.estimatePotentialReduction({
            size,
            pathCount,
            colorCount,
            metadataSize,
            commentSize,
        });
        return {
            size,
            pathCount,
            colorCount,
            metadataSize,
            commentSize,
            potentialReduction,
        };
    }
    // ========== 私有方法 ==========
    /**
     * 初始化优化器
     */
    initializeOptimizer() {
        this.optimizationCache.clear();
        this.pendingOptimizations.clear();
        this.optimizationQueue = [];
        console.log("SVGOptimizer 初始化完成");
    }
    /**
     * 清理优化器
     */
    cleanupOptimizer() {
        this.clearOptimizationCache();
        this.pendingOptimizations.clear();
        this.optimizationQueue = [];
        console.log("SVGOptimizer 清理完成");
    }
    /**
     * 生成缓存键
     */
    generateCacheKey(svgContent, config) {
        const configHash = JSON.stringify(config);
        const contentHash = this.calculateContentHash(svgContent);
        return `${contentHash}_${configHash}`;
    }
    /**
     * 计算内容哈希
     */
    calculateContentHash(content) {
        // 简单哈希函数
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).substring(0, 8);
    }
    /**
     * 缓存优化结果
     */
    cacheOptimizationResult(key, result) {
        // 检查缓存大小限制
        if (this.optimizationCache.size >= this.maxCachedResults) {
            // LRU策略：移除最早的项目
            const firstKey = this.optimizationCache.keys().next().value;
            if (firstKey) {
                this.optimizationCache.delete(firstKey);
            }
        }
        this.optimizationCache.set(key, result);
    }
    /**
     * 处理待优化SVG
     */
    processPendingOptimizations() {
        if (this.pendingOptimizations.size === 0)
            return;
        // 将待优化SVG添加到队列
        this.pendingOptimizations.forEach((svgContent) => {
            if (!this.optimizationQueue.includes(svgContent)) {
                this.optimizationQueue.push(svgContent);
            }
        });
        this.pendingOptimizations.clear();
        // 处理队列中的SVG（限制数量）
        const processCount = Math.min(this.batchOptimizationCount, this.optimizationQueue.length);
        for (let i = 0; i < processCount; i++) {
            const svgContent = this.optimizationQueue.shift();
            if (svgContent) {
                this.optimizeSVG(svgContent).catch(console.error);
            }
        }
    }
    /**
     * 执行优化
     */
    async performOptimization(svgContent, config) {
        let optimizedContent = svgContent;
        // 应用各种优化
        if (config.removeComments) {
            optimizedContent = this.removeComments(optimizedContent);
        }
        if (config.removeMetadata) {
            optimizedContent = this.removeMetadata(optimizedContent);
        }
        if (config.enablePathSimplification) {
            optimizedContent = await this.simplifyPaths(optimizedContent, config.pathSimplificationTolerance);
        }
        if (config.enableColorOptimization) {
            optimizedContent = await this.optimizeColors(optimizedContent, config.maxColors);
        }
        if (config.removeUnusedDefs) {
            optimizedContent = this.removeUnusedDefs(optimizedContent);
        }
        if (config.mergePaths) {
            optimizedContent = await this.mergePaths(optimizedContent);
        }
        if (config.precision > 0) {
            optimizedContent = this.roundNumbers(optimizedContent, config.precision);
        }
        if (config.enableCompression) {
            optimizedContent = this.compressSVG(optimizedContent, config.compressionLevel);
        }
        return optimizedContent;
    }
    /**
     * 移除注释
     */
    removeComments(svgContent) {
        return svgContent.replace(/<!--[\s\S]*?-->/g, "");
    }
    /**
     * 移除元数据
     */
    removeMetadata(svgContent) {
        // 移除各种元数据标签
        return svgContent
            .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
            .replace(/<desc>[\s\S]*?<\/desc>/g, "")
            .replace(/<title>[\s\S]*?<\/title>/g, "");
    }
    /**
     * 简化路径
     */
    async simplifyPaths(svgContent, tolerance) {
        // 这里应该使用路径简化算法
        // 简化实现：返回原始内容
        return svgContent;
    }
    /**
     * 优化颜色
     */
    async optimizeColors(svgContent, maxColors) {
        // 这里应该实现颜色优化算法
        // 简化实现：返回原始内容
        return svgContent;
    }
    /**
     * 移除未使用的定义
     */
    removeUnusedDefs(svgContent) {
        // 这里应该分析并移除未使用的<defs>元素
        // 简化实现：返回原始内容
        return svgContent;
    }
    /**
     * 合并路径
     */
    async mergePaths(svgContent) {
        // 这里应该实现路径合并算法
        // 简化实现：返回原始内容
        return svgContent;
    }
    /**
     * 四舍五入数字
     */
    roundNumbers(svgContent, precision) {
        // 四舍五入SVG中的数字
        const regex = /(\d+\.\d+)/g;
        return svgContent.replace(regex, (match) => {
            return parseFloat(match).toFixed(precision);
        });
    }
    /**
     * 压缩SVG
     */
    compressSVG(svgContent, level) {
        // 简单压缩：移除多余空白
        return svgContent.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
    }
    /**
     * 应用优化结果
     */
    applyOptimization(svgContent, result) {
        // 这里应该根据优化结果应用具体变化
        // 简化实现：返回原始内容
        return svgContent;
    }
    /**
     * 获取优化变化
     */
    getOptimizationChanges(original, optimized) {
        const changes = [];
        if (original.length !== optimized.length) {
            changes.push(`大小: ${original.length} -> ${optimized.length} 字节`);
        }
        // 这里可以添加更多变化检测
        // 简化实现：返回基本变化
        return changes;
    }
    /**
     * 更新性能统计
     */
    updatePerformanceStats(result) {
        this.performanceStats.totalOptimizations++;
        this.performanceStats.totalReduction += result.reductionPercentage;
        this.performanceStats.totalTime += result.optimizationTime;
        // 计算平均值
        this.performanceStats.averageReduction = this.performanceStats.totalReduction / this.performanceStats.totalOptimizations;
        this.performanceStats.averageTime = this.performanceStats.totalTime / this.performanceStats.totalOptimizations;
    }
    /**
     * 从精灵提取SVG
     */
    extractSVGFromSprite(sprite) {
        // 这里需要根据实际项目结构提取SVG内容
        // 简化实现：返回空
        return null;
    }
    /**
     * 计算元数据大小
     */
    calculateMetadataSize(svgContent) {
        const metadataMatch = svgContent.match(/<metadata>[\s\S]*?<\/metadata>/);
        const descMatch = svgContent.match(/<desc>[\s\S]*?<\/desc>/);
        const titleMatch = svgContent.match(/<title>[\s\S]*?<\/title>/);
        let totalSize = 0;
        if (metadataMatch)
            totalSize += metadataMatch[0].length;
        if (descMatch)
            totalSize += descMatch[0].length;
        if (titleMatch)
            totalSize += titleMatch[0].length;
        return totalSize;
    }
    /**
     * 计算注释大小
     */
    calculateCommentSize(svgContent) {
        const commentMatches = svgContent.match(/<!--[\s\S]*?-->/g);
        if (!commentMatches)
            return 0;
        return commentMatches.reduce((total, comment) => total + comment.length, 0);
    }
    /**
     * 估算潜在减少
     */
    estimatePotentialReduction(data) {
        let potentialReduction = 0;
        // 基于元数据的减少
        if (data.metadataSize > 0) {
            potentialReduction += (data.metadataSize / data.size) * 100;
        }
        // 基于注释的减少
        if (data.commentSize > 0) {
            potentialReduction += (data.commentSize / data.size) * 100;
        }
        // 基于路径数量的减少（估算）
        if (data.pathCount > 10) {
            potentialReduction += Math.min(20, data.pathCount * 0.5);
        }
        // 基于颜色数量的减少（估算）
        if (data.colorCount > 8) {
            potentialReduction += Math.min(15, (data.colorCount - 8) * 1.5);
        }
        // 压缩潜力
        potentialReduction += 10; // 基本压缩
        return Math.min(80, potentialReduction); // 最大减少80%
    }
};
exports.SVGOptimizer = SVGOptimizer;
__decorate([
    property({
        tooltip: "启用自动优化",
        displayName: "自动优化",
    })
], SVGOptimizer.prototype, "enableAutoOptimization", void 0);
__decorate([
    property({
        tooltip: "优化配置",
        displayName: "优化配置",
    })
], SVGOptimizer.prototype, "optimizationConfig", void 0);
__decorate([
    property({
        tooltip: "优化阈值（KB）",
        displayName: "优化阈值",
        min: 1,
        max: 1000,
    })
], SVGOptimizer.prototype, "optimizationThreshold", void 0);
__decorate([
    property({
        tooltip: "批量优化数量",
        displayName: "批量优化数",
        min: 1,
        max: 50,
    })
], SVGOptimizer.prototype, "batchOptimizationCount", void 0);
__decorate([
    property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
], SVGOptimizer.prototype, "enablePerformanceMonitoring", void 0);
__decorate([
    property({
        tooltip: "最大缓存优化结果",
        displayName: "最大缓存",
        min: 10,
        max: 1000,
    })
], SVGOptimizer.prototype, "maxCachedResults", void 0);
exports.SVGOptimizer = SVGOptimizer = __decorate([
    ccclass("SVGOptimizer"),
    menu("2D/SVGOptimizer"),
    executeInEditMode
], SVGOptimizer);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHT3B0aW1pemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2NvbXBvbmVudHMvU1ZHT3B0aW1pemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDJCQUFtRDtBQUNuRCxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFVLENBQUM7QUErQmxFOzs7R0FHRztBQUlJLElBQU0sWUFBWSxHQUFsQixNQUFNLFlBQWEsU0FBUSxjQUFTO0lBQXBDO1FBQ0gsNkJBQTZCOztRQU1yQiwyQkFBc0IsR0FBWSxJQUFJLENBQUM7UUFNdkMsdUJBQWtCLEdBQXVCO1lBQzdDLHdCQUF3QixFQUFFLElBQUk7WUFDOUIsMkJBQTJCLEVBQUUsR0FBRztZQUNoQyx1QkFBdUIsRUFBRSxJQUFJO1lBQzdCLFNBQVMsRUFBRSxFQUFFO1lBQ2IsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixnQkFBZ0IsRUFBRSxDQUFDO1lBQ25CLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsVUFBVSxFQUFFLElBQUk7WUFDaEIsU0FBUyxFQUFFLENBQUM7U0FDZixDQUFDO1FBUU0sMEJBQXFCLEdBQVcsRUFBRSxDQUFDLENBQUMsT0FBTztRQVEzQywyQkFBc0IsR0FBVyxFQUFFLENBQUM7UUFFNUMsNkJBQTZCO1FBTXJCLGdDQUEyQixHQUFZLEtBQUssQ0FBQztRQVE3QyxxQkFBZ0IsR0FBVyxHQUFHLENBQUM7UUFFdkMsNkJBQTZCO1FBRXJCLHNCQUFpQixHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUztRQUN6RSx5QkFBb0IsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFNBQVM7UUFDeEQsc0JBQWlCLEdBQWEsRUFBRSxDQUFDLENBQUMsT0FBTztRQUV6QyxxQkFBZ0IsR0FBRztZQUN2QixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLGNBQWMsRUFBRSxDQUFDO1lBQ2pCLGdCQUFnQixFQUFFLENBQUM7WUFDbkIsU0FBUyxFQUFFLENBQUM7WUFDWixXQUFXLEVBQUUsQ0FBQztZQUNkLFNBQVMsRUFBRSxDQUFDO1lBQ1osV0FBVyxFQUFFLENBQUM7U0FDakIsQ0FBQztJQTBnQk4sQ0FBQztJQXhnQkcsK0JBQStCO0lBRS9CLE1BQU07UUFDRixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUMvQixDQUFDO0lBRUQsU0FBUztRQUNMLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCxNQUFNLENBQUMsU0FBaUI7UUFDcEIsSUFBSSxJQUFJLENBQUMsc0JBQXNCLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNwRSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUN2QyxDQUFDO0lBQ0wsQ0FBQztJQUVELDZCQUE2QjtJQUU3Qjs7Ozs7T0FLRztJQUNJLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBa0IsRUFBRSxNQUEyQjtRQUNwRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLE1BQU0sSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUV0RixPQUFPO1FBQ1AsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFFLENBQUM7WUFFM0Qsa0JBQWtCO1lBQ2xCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFFbkQsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFcEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzdCLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUM7UUFFdkMsSUFBSSxDQUFDO1lBQ0QsT0FBTztZQUNQLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLE1BQU0sSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUN2RyxNQUFNLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7WUFDOUMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQUMsWUFBWSxHQUFHLGFBQWEsQ0FBQyxHQUFHLFlBQVksQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNsRixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUM7WUFFaEQsTUFBTSxNQUFNLEdBQXVCO2dCQUMvQixZQUFZO2dCQUNaLGFBQWE7Z0JBQ2IsbUJBQW1CO2dCQUNuQixnQkFBZ0I7Z0JBQ2hCLE9BQU8sRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxFQUFFLGdCQUFnQixDQUFDO2FBQ3JFLENBQUM7WUFFRixPQUFPO1lBQ1AsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUUvQyxTQUFTO1lBQ1QsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXBDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sWUFBWSxPQUFPLGFBQWEsTUFBTSxDQUFDLENBQUM7WUFFdkcsT0FBTyxnQkFBZ0IsQ0FBQztRQUM1QixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2pDLE9BQU8sVUFBVSxDQUFDLENBQUMsWUFBWTtRQUNuQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLGdCQUFnQixDQUFDLFdBQXFCLEVBQUUsTUFBMkI7UUFDNUUsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV2RixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsTUFBYyxFQUFFLE1BQTJCOztRQUN0RSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDekIsT0FBTztRQUNYLENBQUM7UUFFRCxpQkFBaUI7UUFDakIsb0JBQW9CO1FBQ3BCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDZCxPQUFPLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzdCLE9BQU87UUFDWCxDQUFDO1FBRUQsUUFBUTtRQUNSLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUVwRSx1QkFBdUI7UUFDdkIsY0FBYztRQUNkLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFBLE1BQUEsTUFBTSxDQUFDLElBQUksMENBQUUsSUFBSSxLQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVEOztPQUVHO0lBQ0ksb0JBQW9CO1FBQ3ZCLHlCQUFZLElBQUksQ0FBQyxnQkFBZ0IsRUFBRztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSSxzQkFBc0I7UUFDekIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVEOztPQUVHO0lBQ0ksWUFBWTtRQUtmLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFckgsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDO1FBQzFGLE1BQU0sT0FBTyxHQUFHLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsR0FBRyxhQUFhLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVoRyxPQUFPO1lBQ0gsSUFBSSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJO1lBQ2pDLE9BQU87WUFDUCxTQUFTO1NBQ1osQ0FBQztJQUNOLENBQUM7SUFFRDs7O09BR0c7SUFDSSxxQkFBcUIsQ0FBQyxNQUEwQjtRQUNuRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsTUFBTSxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFdkIsZUFBZTtRQUNmLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksNEJBQTRCLENBQUMsVUFBa0I7UUFRbEQsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUUvQixTQUFTO1FBQ1QsTUFBTSxTQUFTLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUU1RCxTQUFTO1FBQ1QsTUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUM3RixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFFOUMsVUFBVTtRQUNWLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU1RCxTQUFTO1FBQ1QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTFELFNBQVM7UUFDVCxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQztZQUN2RCxJQUFJO1lBQ0osU0FBUztZQUNULFVBQVU7WUFDVixZQUFZO1lBQ1osV0FBVztTQUNkLENBQUMsQ0FBQztRQUVILE9BQU87WUFDSCxJQUFJO1lBQ0osU0FBUztZQUNULFVBQVU7WUFDVixZQUFZO1lBQ1osV0FBVztZQUNYLGtCQUFrQjtTQUNyQixDQUFDO0lBQ04sQ0FBQztJQUVELDZCQUE2QjtJQUU3Qjs7T0FFRztJQUNLLG1CQUFtQjtRQUN2QixJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDL0IsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFFLENBQUM7UUFFNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNLLGdCQUFnQjtRQUNwQixJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUM5QixJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztRQUU1QixPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZ0JBQWdCLENBQUMsVUFBa0IsRUFBRSxNQUEwQjtRQUNuRSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxRCxPQUFPLEdBQUcsV0FBVyxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFFRDs7T0FFRztJQUNLLG9CQUFvQixDQUFDLE9BQWU7UUFDeEMsU0FBUztRQUNULElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztRQUNiLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdEMsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNqQyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztRQUN2QixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRDs7T0FFRztJQUNLLHVCQUF1QixDQUFDLEdBQVcsRUFBRSxNQUEwQjtRQUNuRSxXQUFXO1FBQ1gsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3ZELGdCQUFnQjtZQUNoQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDO1lBQzVELElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ1gsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7T0FFRztJQUNLLDJCQUEyQjtRQUMvQixJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEtBQUssQ0FBQztZQUFFLE9BQU87UUFFakQsZUFBZTtRQUNmLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRTtZQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUMvQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVsQyxrQkFBa0I7UUFDbEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTFGLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNwQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDbEQsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDYixJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEQsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsbUJBQW1CLENBQUMsVUFBa0IsRUFBRSxNQUEwQjtRQUM1RSxJQUFJLGdCQUFnQixHQUFHLFVBQVUsQ0FBQztRQUVsQyxTQUFTO1FBQ1QsSUFBSSxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDeEIsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFFRCxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN4QixnQkFBZ0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUVELElBQUksTUFBTSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDbEMsZ0JBQWdCLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1FBQ3RHLENBQUM7UUFFRCxJQUFJLE1BQU0sQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ2pDLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckYsQ0FBQztRQUVELElBQUksTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDMUIsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdkIsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVELElBQUksTUFBTSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0IsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBRUQsT0FBTyxnQkFBZ0IsQ0FBQztJQUM1QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxjQUFjLENBQUMsVUFBa0I7UUFDckMsT0FBTyxVQUFVLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7T0FFRztJQUNLLGNBQWMsQ0FBQyxVQUFrQjtRQUNyQyxZQUFZO1FBQ1osT0FBTyxVQUFVO2FBQ1osT0FBTyxDQUFDLGlDQUFpQyxFQUFFLEVBQUUsQ0FBQzthQUM5QyxPQUFPLENBQUMseUJBQXlCLEVBQUUsRUFBRSxDQUFDO2FBQ3RDLE9BQU8sQ0FBQywyQkFBMkIsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQWtCLEVBQUUsU0FBaUI7UUFDN0QsZUFBZTtRQUNmLGNBQWM7UUFDZCxPQUFPLFVBQVUsQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsY0FBYyxDQUFDLFVBQWtCLEVBQUUsU0FBaUI7UUFDOUQsZUFBZTtRQUNmLGNBQWM7UUFDZCxPQUFPLFVBQVUsQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxnQkFBZ0IsQ0FBQyxVQUFrQjtRQUN2Qyx3QkFBd0I7UUFDeEIsY0FBYztRQUNkLE9BQU8sVUFBVSxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBa0I7UUFDdkMsZUFBZTtRQUNmLGNBQWM7UUFDZCxPQUFPLFVBQVUsQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxZQUFZLENBQUMsVUFBa0IsRUFBRSxTQUFpQjtRQUN0RCxjQUFjO1FBQ2QsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDO1FBQzVCLE9BQU8sVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2QyxPQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUMsVUFBa0IsRUFBRSxLQUFhO1FBQ2pELGNBQWM7UUFDZCxPQUFPLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDMUUsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCLENBQUMsVUFBa0IsRUFBRSxNQUEwQjtRQUNwRSxtQkFBbUI7UUFDbkIsY0FBYztRQUNkLE9BQU8sVUFBVSxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7T0FFRztJQUNLLHNCQUFzQixDQUFDLFFBQWdCLEVBQUUsU0FBaUI7UUFDOUQsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBRTdCLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDdkMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLFFBQVEsQ0FBQyxNQUFNLE9BQU8sU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUVELGVBQWU7UUFDZixjQUFjO1FBRWQsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssc0JBQXNCLENBQUMsTUFBMEI7UUFDckQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsSUFBSSxNQUFNLENBQUMsbUJBQW1CLENBQUM7UUFDbkUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFFM0QsUUFBUTtRQUNSLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQztRQUN6SCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDO0lBQ25ILENBQUM7SUFFRDs7T0FFRztJQUNLLG9CQUFvQixDQUFDLE1BQWM7UUFDdkMsc0JBQXNCO1FBQ3RCLFdBQVc7UUFDWCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxxQkFBcUIsQ0FBQyxVQUFrQjtRQUM1QyxNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDekUsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQzdELE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUVoRSxJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbEIsSUFBSSxhQUFhO1lBQUUsU0FBUyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDeEQsSUFBSSxTQUFTO1lBQUUsU0FBUyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDaEQsSUFBSSxVQUFVO1lBQUUsU0FBUyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFFbEQsT0FBTyxTQUFTLENBQUM7SUFDckIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssb0JBQW9CLENBQUMsVUFBa0I7UUFDM0MsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzVELElBQUksQ0FBQyxjQUFjO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFFOUIsT0FBTyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVEOztPQUVHO0lBQ0ssMEJBQTBCLENBQUMsSUFNbEM7UUFDRyxJQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQztRQUUzQixXQUFXO1FBQ1gsSUFBSSxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3hCLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ2hFLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQy9ELENBQUM7UUFFRCxnQkFBZ0I7UUFDaEIsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQ3RCLGtCQUFrQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDN0QsQ0FBQztRQUVELGdCQUFnQjtRQUNoQixJQUFJLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdEIsa0JBQWtCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFFRCxPQUFPO1FBQ1Asa0JBQWtCLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTztRQUVqQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxVQUFVO0lBQ3ZELENBQUM7Q0FDSixDQUFBO0FBbmxCWSxvQ0FBWTtBQU9iO0lBSlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFFBQVE7UUFDakIsV0FBVyxFQUFFLE1BQU07S0FDdEIsQ0FBQzs0REFDNkM7QUFNdkM7SUFKUCxRQUFRLENBQUM7UUFDTixPQUFPLEVBQUUsTUFBTTtRQUNmLFdBQVcsRUFBRSxNQUFNO0tBQ3RCLENBQUM7d0RBYUE7QUFRTTtJQU5QLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxVQUFVO1FBQ25CLFdBQVcsRUFBRSxNQUFNO1FBQ25CLEdBQUcsRUFBRSxDQUFDO1FBQ04sR0FBRyxFQUFFLElBQUk7S0FDWixDQUFDOzJEQUN5QztBQVFuQztJQU5QLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxRQUFRO1FBQ2pCLFdBQVcsRUFBRSxPQUFPO1FBQ3BCLEdBQUcsRUFBRSxDQUFDO1FBQ04sR0FBRyxFQUFFLEVBQUU7S0FDVixDQUFDOzREQUMwQztBQVFwQztJQUpQLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxRQUFRO1FBQ2pCLFdBQVcsRUFBRSxNQUFNO0tBQ3RCLENBQUM7aUVBQ21EO0FBUTdDO0lBTlAsUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFVBQVU7UUFDbkIsV0FBVyxFQUFFLE1BQU07UUFDbkIsR0FBRyxFQUFFLEVBQUU7UUFDUCxHQUFHLEVBQUUsSUFBSTtLQUNaLENBQUM7c0RBQ3FDO3VCQXpEOUIsWUFBWTtJQUh4QixPQUFPLENBQUMsY0FBYyxDQUFDO0lBQ3ZCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztJQUN2QixpQkFBaUI7R0FDTCxZQUFZLENBbWxCeEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIFNwcml0ZSB9IGZyb20gXCJjY1wiO1xuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUgfSA9IF9kZWNvcmF0b3I7XG5cblxuLyoqXG4gKiDkvJjljJbphY3nva5cbiAqL1xuaW50ZXJmYWNlIE9wdGltaXphdGlvbkNvbmZpZyB7XG4gICAgZW5hYmxlUGF0aFNpbXBsaWZpY2F0aW9uOiBib29sZWFuOyAvLyDlkK/nlKjot6/lvoTnroDljJZcbiAgICBwYXRoU2ltcGxpZmljYXRpb25Ub2xlcmFuY2U6IG51bWJlcjsgLy8g6Lev5b6E566A5YyW5a655beu77yIMC0x77yJXG4gICAgZW5hYmxlQ29sb3JPcHRpbWl6YXRpb246IGJvb2xlYW47IC8vIOWQr+eUqOminOiJsuS8mOWMllxuICAgIG1heENvbG9yczogbnVtYmVyOyAvLyDmnIDlpKfpopzoibLmlbDph49cbiAgICBlbmFibGVDb21wcmVzc2lvbjogYm9vbGVhbjsgLy8g5ZCv55So5Y6L57ypXG4gICAgY29tcHJlc3Npb25MZXZlbDogbnVtYmVyOyAvLyDljovnvKnnuqfliKvvvIgwLTnvvIlcbiAgICByZW1vdmVNZXRhZGF0YTogYm9vbGVhbjsgLy8g56e76Zmk5YWD5pWw5o2uXG4gICAgcmVtb3ZlQ29tbWVudHM6IGJvb2xlYW47IC8vIOenu+mZpOazqOmHilxuICAgIHJlbW92ZVVudXNlZERlZnM6IGJvb2xlYW47IC8vIOenu+mZpOacquS9v+eUqOeahOWumuS5iVxuICAgIG1lcmdlUGF0aHM6IGJvb2xlYW47IC8vIOWQiOW5tui3r+W+hFxuICAgIHByZWNpc2lvbjogbnVtYmVyOyAvLyDmlbDlgLznsr7luqbvvIjlsI/mlbDngrnlkI7kvY3mlbDvvIlcbn1cblxuLyoqXG4gKiDkvJjljJbnu5PmnpxcbiAqL1xuaW50ZXJmYWNlIE9wdGltaXphdGlvblJlc3VsdCB7XG4gICAgb3JpZ2luYWxTaXplOiBudW1iZXI7IC8vIOWOn+Wni+Wkp+Wwj++8iOWtl+iKgu+8iVxuICAgIG9wdGltaXplZFNpemU6IG51bWJlcjsgLy8g5LyY5YyW5ZCO5aSn5bCP77yI5a2X6IqC77yJXG4gICAgcmVkdWN0aW9uUGVyY2VudGFnZTogbnVtYmVyOyAvLyDlh4/lsJHnmb7liIbmr5RcbiAgICBvcHRpbWl6YXRpb25UaW1lOiBudW1iZXI7IC8vIOS8mOWMluaXtumXtO+8iOavq+enku+8iVxuICAgIGNoYW5nZXM6IHN0cmluZ1tdOyAvLyDlhbfkvZPlj5jljJZcbn1cblxuLyoqXG4gKiBTVkfkvJjljJblmahcbiAqIOaPkOS+m+WQhOenjVNWR+S8mOWMluWKn+iDve+8jOWmgui3r+W+hOeugOWMluOAgeminOiJsuS8mOWMluOAgeWOi+e8qeetiVxuICovXG5AY2NjbGFzcyhcIlNWR09wdGltaXplclwiKVxuQG1lbnUoXCIyRC9TVkdPcHRpbWl6ZXJcIilcbkBleGVjdXRlSW5FZGl0TW9kZVxuZXhwb3J0IGNsYXNzIFNWR09wdGltaXplciBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLy8gPT09PT09PT09PSDkvJjljJbphY3nva4gPT09PT09PT09PVxuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjoh6rliqjkvJjljJZcIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi6Ieq5Yqo5LyY5YyWXCIsXG4gICAgfSlcbiAgICBwcml2YXRlIGVuYWJsZUF1dG9PcHRpbWl6YXRpb246IGJvb2xlYW4gPSB0cnVlO1xuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLkvJjljJbphY3nva5cIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5LyY5YyW6YWN572uXCIsXG4gICAgfSlcbiAgICBwcml2YXRlIG9wdGltaXphdGlvbkNvbmZpZzogT3B0aW1pemF0aW9uQ29uZmlnID0ge1xuICAgICAgICBlbmFibGVQYXRoU2ltcGxpZmljYXRpb246IHRydWUsXG4gICAgICAgIHBhdGhTaW1wbGlmaWNhdGlvblRvbGVyYW5jZTogMC4xLFxuICAgICAgICBlbmFibGVDb2xvck9wdGltaXphdGlvbjogdHJ1ZSxcbiAgICAgICAgbWF4Q29sb3JzOiAxNixcbiAgICAgICAgZW5hYmxlQ29tcHJlc3Npb246IHRydWUsXG4gICAgICAgIGNvbXByZXNzaW9uTGV2ZWw6IDYsXG4gICAgICAgIHJlbW92ZU1ldGFkYXRhOiB0cnVlLFxuICAgICAgICByZW1vdmVDb21tZW50czogdHJ1ZSxcbiAgICAgICAgcmVtb3ZlVW51c2VkRGVmczogdHJ1ZSxcbiAgICAgICAgbWVyZ2VQYXRoczogdHJ1ZSxcbiAgICAgICAgcHJlY2lzaW9uOiAzLFxuICAgIH07XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuS8mOWMlumYiOWAvO+8iEtC77yJXCIsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuS8mOWMlumYiOWAvFwiLFxuICAgICAgICBtaW46IDEsXG4gICAgICAgIG1heDogMTAwMCxcbiAgICB9KVxuICAgIHByaXZhdGUgb3B0aW1pemF0aW9uVGhyZXNob2xkOiBudW1iZXIgPSAxMDsgLy8gMTBLQlxuXG4gICAgQHByb3BlcnR5KHtcbiAgICAgICAgdG9vbHRpcDogXCLmibnph4/kvJjljJbmlbDph49cIixcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5om56YeP5LyY5YyW5pWwXCIsXG4gICAgICAgIG1pbjogMSxcbiAgICAgICAgbWF4OiA1MCxcbiAgICB9KVxuICAgIHByaXZhdGUgYmF0Y2hPcHRpbWl6YXRpb25Db3VudDogbnVtYmVyID0gMTA7XG5cbiAgICAvLyA9PT09PT09PT09IOaAp+iDvemFjee9riA9PT09PT09PT09XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqOaAp+iDveebkeaOp1wiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmgKfog73nm5HmjqdcIixcbiAgICB9KVxuICAgIHByaXZhdGUgZW5hYmxlUGVyZm9ybWFuY2VNb25pdG9yaW5nOiBib29sZWFuID0gZmFsc2U7XG5cbiAgICBAcHJvcGVydHkoe1xuICAgICAgICB0b29sdGlwOiBcIuacgOWkp+e8k+WtmOS8mOWMlue7k+aenFwiLFxuICAgICAgICBkaXNwbGF5TmFtZTogXCLmnIDlpKfnvJPlrZhcIixcbiAgICAgICAgbWluOiAxMCxcbiAgICAgICAgbWF4OiAxMDAwLFxuICAgIH0pXG4gICAgcHJpdmF0ZSBtYXhDYWNoZWRSZXN1bHRzOiBudW1iZXIgPSAxMDA7XG5cbiAgICAvLyA9PT09PT09PT09IOWGhemDqOeKtuaAgSA9PT09PT09PT09XG5cbiAgICBwcml2YXRlIG9wdGltaXphdGlvbkNhY2hlOiBNYXA8c3RyaW5nLCBPcHRpbWl6YXRpb25SZXN1bHQ+ID0gbmV3IE1hcCgpOyAvLyDkvJjljJbnu5PmnpznvJPlrZhcbiAgICBwcml2YXRlIHBlbmRpbmdPcHRpbWl6YXRpb25zOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTsgLy8g5b6F5LyY5YyWU1ZHXG4gICAgcHJpdmF0ZSBvcHRpbWl6YXRpb25RdWV1ZTogc3RyaW5nW10gPSBbXTsgLy8g5LyY5YyW6Zif5YiXXG5cbiAgICBwcml2YXRlIHBlcmZvcm1hbmNlU3RhdHMgPSB7XG4gICAgICAgIHRvdGFsT3B0aW1pemF0aW9uczogMCxcbiAgICAgICAgdG90YWxSZWR1Y3Rpb246IDAsXG4gICAgICAgIGF2ZXJhZ2VSZWR1Y3Rpb246IDAsXG4gICAgICAgIHRvdGFsVGltZTogMCxcbiAgICAgICAgYXZlcmFnZVRpbWU6IDAsXG4gICAgICAgIGNhY2hlSGl0czogMCxcbiAgICAgICAgY2FjaGVNaXNzZXM6IDAsXG4gICAgfTtcblxuICAgIC8vID09PT09PT09PT0g55Sf5ZG95ZGo5pyf5pa55rOVID09PT09PT09PT1cblxuICAgIG9uTG9hZCgpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplT3B0aW1pemVyKCk7XG4gICAgfVxuXG4gICAgb25EZXN0cm95KCkge1xuICAgICAgICB0aGlzLmNsZWFudXBPcHRpbWl6ZXIoKTtcbiAgICB9XG5cbiAgICB1cGRhdGUoZGVsdGFUaW1lOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQXV0b09wdGltaXphdGlvbiAmJiB0aGlzLnBlbmRpbmdPcHRpbWl6YXRpb25zLnNpemUgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NQZW5kaW5nT3B0aW1pemF0aW9ucygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PSDlhazlhbHmlrnms5UgPT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICog5LyY5YyWU1ZH5YaF5a65XG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a65XG4gICAgICogQHBhcmFtIGNvbmZpZyDkvJjljJbphY3nva7vvIjlj6/pgInvvIzkvb/nlKjpu5jorqTphY3nva7vvIlcbiAgICAgKiBAcmV0dXJucyDkvJjljJblkI7nmoRTVkflhoXlrrlcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgb3B0aW1pemVTVkcoc3ZnQ29udGVudDogc3RyaW5nLCBjb25maWc/OiBPcHRpbWl6YXRpb25Db25maWcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICBjb25zdCBjYWNoZUtleSA9IHRoaXMuZ2VuZXJhdGVDYWNoZUtleShzdmdDb250ZW50LCBjb25maWcgfHwgdGhpcy5vcHRpbWl6YXRpb25Db25maWcpO1xuXG4gICAgICAgIC8vIOajgOafpee8k+WtmFxuICAgICAgICBpZiAodGhpcy5vcHRpbWl6YXRpb25DYWNoZS5oYXMoY2FjaGVLZXkpKSB7XG4gICAgICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuY2FjaGVIaXRzKys7XG4gICAgICAgICAgICBjb25zdCBjYWNoZWRSZXN1bHQgPSB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmdldChjYWNoZUtleSkhO1xuXG4gICAgICAgICAgICAvLyDmm7TmlrDnvJPlrZjorr/pl67ml7bpl7TvvIhMUlXnrZbnlaXvvIlcbiAgICAgICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuZGVsZXRlKGNhY2hlS2V5KTtcbiAgICAgICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuc2V0KGNhY2hlS2V5LCBjYWNoZWRSZXN1bHQpO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hcHBseU9wdGltaXphdGlvbihzdmdDb250ZW50LCBjYWNoZWRSZXN1bHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmNhY2hlTWlzc2VzKys7XG5cbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxTaXplID0gc3ZnQ29udGVudC5sZW5ndGg7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOaJp+ihjOS8mOWMllxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMucGVyZm9ybU9wdGltaXphdGlvbihzdmdDb250ZW50LCBjb25maWcgfHwgdGhpcy5vcHRpbWl6YXRpb25Db25maWcpO1xuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkU2l6ZSA9IG9wdGltaXplZENvbnRlbnQubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3QgcmVkdWN0aW9uUGVyY2VudGFnZSA9ICgob3JpZ2luYWxTaXplIC0gb3B0aW1pemVkU2l6ZSkgLyBvcmlnaW5hbFNpemUpICogMTAwO1xuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemF0aW9uVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogT3B0aW1pemF0aW9uUmVzdWx0ID0ge1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsU2l6ZSxcbiAgICAgICAgICAgICAgICBvcHRpbWl6ZWRTaXplLFxuICAgICAgICAgICAgICAgIHJlZHVjdGlvblBlcmNlbnRhZ2UsXG4gICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uVGltZSxcbiAgICAgICAgICAgICAgICBjaGFuZ2VzOiB0aGlzLmdldE9wdGltaXphdGlvbkNoYW5nZXMoc3ZnQ29udGVudCwgb3B0aW1pemVkQ29udGVudCksXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyDnvJPlrZjnu5PmnpxcbiAgICAgICAgICAgIHRoaXMuY2FjaGVPcHRpbWl6YXRpb25SZXN1bHQoY2FjaGVLZXksIHJlc3VsdCk7XG5cbiAgICAgICAgICAgIC8vIOabtOaWsOaAp+iDvee7n+iuoVxuICAgICAgICAgICAgdGhpcy51cGRhdGVQZXJmb3JtYW5jZVN0YXRzKHJlc3VsdCk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTVkfkvJjljJblrozmiJA6IOWHj+WwkSAke3JlZHVjdGlvblBlcmNlbnRhZ2UudG9GaXhlZCgyKX0lICgke29yaWdpbmFsU2l6ZX0gLT4gJHtvcHRpbWl6ZWRTaXplfSDlrZfoioIpYCk7XG5cbiAgICAgICAgICAgIHJldHVybiBvcHRpbWl6ZWRDb250ZW50O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlNWR+S8mOWMluWksei0pTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnQ7IC8vIOWksei0peaXtui/lOWbnuWOn+Wni+WGheWuuVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5om56YeP5LyY5YyWU1ZHXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnRzIFNWR+WGheWuueaVsOe7hFxuICAgICAqIEBwYXJhbSBjb25maWcg5LyY5YyW6YWN572u77yI5Y+v6YCJ77yJXG4gICAgICogQHJldHVybnMg5LyY5YyW5ZCO55qEU1ZH5YaF5a655pWw57uEXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGJhdGNoT3B0aW1pemVTVkcoc3ZnQ29udGVudHM6IHN0cmluZ1tdLCBjb25maWc/OiBPcHRpbWl6YXRpb25Db25maWcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIGNvbnN0IHByb21pc2VzID0gc3ZnQ29udGVudHMubWFwKChzdmdDb250ZW50KSA9PiB0aGlzLm9wdGltaXplU1ZHKHN2Z0NvbnRlbnQsIGNvbmZpZykpO1xuXG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5LyY5YyW57K+54G155qEU1ZHXG4gICAgICogQHBhcmFtIHNwcml0ZSDnsr7ngbXnu4Tku7ZcbiAgICAgKiBAcGFyYW0gY29uZmlnIOS8mOWMlumFjee9ru+8iOWPr+mAie+8iVxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBvcHRpbWl6ZVNwcml0ZVNWRyhzcHJpdGU6IFNwcml0ZSwgY29uZmlnPzogT3B0aW1pemF0aW9uQ29uZmlnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghc3ByaXRlIHx8ICFzcHJpdGUuc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIueyvueBteaIlueyvueBteW4p+aXoOaViFwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOi/memHjOmcgOimgeS7jueyvueBteiOt+WPllNWR+WGheWuuVxuICAgICAgICAvLyDnroDljJblrp7njrDvvJrlgYforr7nsr7ngbXmnIlTVkflhoXlrrnlsZ7mgKdcbiAgICAgICAgY29uc3Qgc3ZnQ29udGVudCA9IHRoaXMuZXh0cmFjdFNWR0Zyb21TcHJpdGUoc3ByaXRlKTtcbiAgICAgICAgaWYgKCFzdmdDb250ZW50KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLml6Dms5Xku47nsr7ngbXojrflj5ZTVkflhoXlrrlcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDkvJjljJZTVkdcbiAgICAgICAgY29uc3Qgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMub3B0aW1pemVTVkcoc3ZnQ29udGVudCwgY29uZmlnKTtcblxuICAgICAgICAvLyDmm7TmlrDnsr7ngbXvvIjov5nph4zpnIDopoHmoLnmja7lrp7pmYXpobnnm67nu5PmnoTlrp7njrDvvIlcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6K6w5b2V5LyY5YyW57uT5p6cXG4gICAgICAgIGNvbnNvbGUubG9nKGDnsr7ngbVTVkfkvJjljJblrozmiJA6ICR7c3ByaXRlLm5vZGU/Lm5hbWUgfHwgXCLmnKrnn6Xnsr7ngbVcIn1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDojrflj5bkvJjljJbnu5/orqFcbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0T3B0aW1pemF0aW9uU3RhdHMoKTogdHlwZW9mIHRoaXMucGVyZm9ybWFuY2VTdGF0cyB7XG4gICAgICAgIHJldHVybiB7IC4uLnRoaXMucGVyZm9ybWFuY2VTdGF0cyB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOa4hemZpOS8mOWMlue8k+WtmFxuICAgICAqL1xuICAgIHB1YmxpYyBjbGVhck9wdGltaXphdGlvbkNhY2hlKCk6IHZvaWQge1xuICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmNsZWFyKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi5LyY5YyW57yT5a2Y5bey5riF6ZmkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPlue8k+WtmOS/oeaBr1xuICAgICAqL1xuICAgIHB1YmxpYyBnZXRDYWNoZUluZm8oKToge1xuICAgICAgICBzaXplOiBudW1iZXI7XG4gICAgICAgIGhpdFJhdGU6IG51bWJlcjtcbiAgICAgICAgdG90YWxTaXplOiBudW1iZXI7XG4gICAgfSB7XG4gICAgICAgIGNvbnN0IHRvdGFsU2l6ZSA9IEFycmF5LmZyb20odGhpcy5vcHRpbWl6YXRpb25DYWNoZS52YWx1ZXMoKSkucmVkdWNlKChzdW0sIHJlc3VsdCkgPT4gc3VtICsgcmVzdWx0Lm9wdGltaXplZFNpemUsIDApO1xuXG4gICAgICAgIGNvbnN0IHRvdGFsQWNjZXNzZXMgPSB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuY2FjaGVIaXRzICsgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmNhY2hlTWlzc2VzO1xuICAgICAgICBjb25zdCBoaXRSYXRlID0gdG90YWxBY2Nlc3NlcyA+IDAgPyAodGhpcy5wZXJmb3JtYW5jZVN0YXRzLmNhY2hlSGl0cyAvIHRvdGFsQWNjZXNzZXMpICogMTAwIDogMDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2l6ZTogdGhpcy5vcHRpbWl6YXRpb25DYWNoZS5zaXplLFxuICAgICAgICAgICAgaGl0UmF0ZSxcbiAgICAgICAgICAgIHRvdGFsU2l6ZSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDorr7nva7kvJjljJbphY3nva5cbiAgICAgKiBAcGFyYW0gY29uZmlnIOaWsOeahOS8mOWMlumFjee9rlxuICAgICAqL1xuICAgIHB1YmxpYyBzZXRPcHRpbWl6YXRpb25Db25maWcoY29uZmlnOiBPcHRpbWl6YXRpb25Db25maWcpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5vcHRpbWl6YXRpb25Db25maWcgPSBjb25maWc7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi5LyY5YyW6YWN572u5bey5pu05pawXCIpO1xuXG4gICAgICAgIC8vIOa4hemZpOe8k+WtmO+8jOWboOS4uumFjee9ruW3suabtOaUuVxuICAgICAgICB0aGlzLmNsZWFyT3B0aW1pemF0aW9uQ2FjaGUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDliIbmnpBTVkfkvJjljJbmvZzliptcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrlcbiAgICAgKiBAcmV0dXJucyDkvJjljJbmvZzlipvliIbmnpBcbiAgICAgKi9cbiAgICBwdWJsaWMgYW5hbHl6ZU9wdGltaXphdGlvblBvdGVudGlhbChzdmdDb250ZW50OiBzdHJpbmcpOiB7XG4gICAgICAgIHNpemU6IG51bWJlcjtcbiAgICAgICAgcGF0aENvdW50OiBudW1iZXI7XG4gICAgICAgIGNvbG9yQ291bnQ6IG51bWJlcjtcbiAgICAgICAgbWV0YWRhdGFTaXplOiBudW1iZXI7XG4gICAgICAgIGNvbW1lbnRTaXplOiBudW1iZXI7XG4gICAgICAgIHBvdGVudGlhbFJlZHVjdGlvbjogbnVtYmVyO1xuICAgIH0ge1xuICAgICAgICBjb25zdCBzaXplID0gc3ZnQ29udGVudC5sZW5ndGg7XG5cbiAgICAgICAgLy8g5YiG5p6Q6Lev5b6E5pWw6YePXG4gICAgICAgIGNvbnN0IHBhdGhDb3VudCA9IChzdmdDb250ZW50Lm1hdGNoKC88cGF0aC9nKSB8fCBbXSkubGVuZ3RoO1xuXG4gICAgICAgIC8vIOWIhuaekOminOiJsuaVsOmHj1xuICAgICAgICBjb25zdCBjb2xvck1hdGNoZXMgPSBzdmdDb250ZW50Lm1hdGNoKC8jWzAtOWEtZkEtRl17Myw2fXxyZ2JcXChbXildK1xcKXxyZ2JhXFwoW14pXStcXCkvZykgfHwgW107XG4gICAgICAgIGNvbnN0IGNvbG9yQ291bnQgPSBuZXcgU2V0KGNvbG9yTWF0Y2hlcykuc2l6ZTtcblxuICAgICAgICAvLyDliIbmnpDlhYPmlbDmja7lpKflsI9cbiAgICAgICAgY29uc3QgbWV0YWRhdGFTaXplID0gdGhpcy5jYWxjdWxhdGVNZXRhZGF0YVNpemUoc3ZnQ29udGVudCk7XG5cbiAgICAgICAgLy8g5YiG5p6Q5rOo6YeK5aSn5bCPXG4gICAgICAgIGNvbnN0IGNvbW1lbnRTaXplID0gdGhpcy5jYWxjdWxhdGVDb21tZW50U2l6ZShzdmdDb250ZW50KTtcblxuICAgICAgICAvLyDkvLDnrpfmvZzlnKjlh4/lsJFcbiAgICAgICAgY29uc3QgcG90ZW50aWFsUmVkdWN0aW9uID0gdGhpcy5lc3RpbWF0ZVBvdGVudGlhbFJlZHVjdGlvbih7XG4gICAgICAgICAgICBzaXplLFxuICAgICAgICAgICAgcGF0aENvdW50LFxuICAgICAgICAgICAgY29sb3JDb3VudCxcbiAgICAgICAgICAgIG1ldGFkYXRhU2l6ZSxcbiAgICAgICAgICAgIGNvbW1lbnRTaXplLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2l6ZSxcbiAgICAgICAgICAgIHBhdGhDb3VudCxcbiAgICAgICAgICAgIGNvbG9yQ291bnQsXG4gICAgICAgICAgICBtZXRhZGF0YVNpemUsXG4gICAgICAgICAgICBjb21tZW50U2l6ZSxcbiAgICAgICAgICAgIHBvdGVudGlhbFJlZHVjdGlvbixcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09IOengeacieaWueazlSA9PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiDliJ3lp4vljJbkvJjljJblmahcbiAgICAgKi9cbiAgICBwcml2YXRlIGluaXRpYWxpemVPcHRpbWl6ZXIoKTogdm9pZCB7XG4gICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5wZW5kaW5nT3B0aW1pemF0aW9ucy5jbGVhcigpO1xuICAgICAgICB0aGlzLm9wdGltaXphdGlvblF1ZXVlID0gW107XG5cbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdPcHRpbWl6ZXIg5Yid5aeL5YyW5a6M5oiQXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOa4heeQhuS8mOWMluWZqFxuICAgICAqL1xuICAgIHByaXZhdGUgY2xlYW51cE9wdGltaXplcigpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jbGVhck9wdGltaXphdGlvbkNhY2hlKCk7XG4gICAgICAgIHRoaXMucGVuZGluZ09wdGltaXphdGlvbnMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5vcHRpbWl6YXRpb25RdWV1ZSA9IFtdO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU1ZHT3B0aW1pemVyIOa4heeQhuWujOaIkFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDnlJ/miJDnvJPlrZjplK5cbiAgICAgKi9cbiAgICBwcml2YXRlIGdlbmVyYXRlQ2FjaGVLZXkoc3ZnQ29udGVudDogc3RyaW5nLCBjb25maWc6IE9wdGltaXphdGlvbkNvbmZpZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ0hhc2ggPSBKU09OLnN0cmluZ2lmeShjb25maWcpO1xuICAgICAgICBjb25zdCBjb250ZW50SGFzaCA9IHRoaXMuY2FsY3VsYXRlQ29udGVudEhhc2goc3ZnQ29udGVudCk7XG4gICAgICAgIHJldHVybiBgJHtjb250ZW50SGFzaH1fJHtjb25maWdIYXNofWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog6K6h566X5YaF5a655ZOI5biMXG4gICAgICovXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVDb250ZW50SGFzaChjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAvLyDnroDljZXlk4jluIzlh73mlbBcbiAgICAgICAgbGV0IGhhc2ggPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnRlbnQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSBjb250ZW50LmNoYXJDb2RlQXQoaSk7XG4gICAgICAgICAgICBoYXNoID0gKGhhc2ggPDwgNSkgLSBoYXNoICsgY2hhcjtcbiAgICAgICAgICAgIGhhc2ggPSBoYXNoICYgaGFzaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gTWF0aC5hYnMoaGFzaCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygwLCA4KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDnvJPlrZjkvJjljJbnu5PmnpxcbiAgICAgKi9cbiAgICBwcml2YXRlIGNhY2hlT3B0aW1pemF0aW9uUmVzdWx0KGtleTogc3RyaW5nLCByZXN1bHQ6IE9wdGltaXphdGlvblJlc3VsdCk6IHZvaWQge1xuICAgICAgICAvLyDmo4Dmn6XnvJPlrZjlpKflsI/pmZDliLZcbiAgICAgICAgaWYgKHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuc2l6ZSA+PSB0aGlzLm1heENhY2hlZFJlc3VsdHMpIHtcbiAgICAgICAgICAgIC8vIExSVeetlueVpe+8muenu+mZpOacgOaXqeeahOmhueebrlxuICAgICAgICAgICAgY29uc3QgZmlyc3RLZXkgPSB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmtleXMoKS5uZXh0KCkudmFsdWU7XG4gICAgICAgICAgICBpZiAoZmlyc3RLZXkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmRlbGV0ZShmaXJzdEtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLnNldChrZXksIHJlc3VsdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5aSE55CG5b6F5LyY5YyWU1ZHXG4gICAgICovXG4gICAgcHJpdmF0ZSBwcm9jZXNzUGVuZGluZ09wdGltaXphdGlvbnMoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnBlbmRpbmdPcHRpbWl6YXRpb25zLnNpemUgPT09IDApIHJldHVybjtcblxuICAgICAgICAvLyDlsIblvoXkvJjljJZTVkfmt7vliqDliLDpmJ/liJdcbiAgICAgICAgdGhpcy5wZW5kaW5nT3B0aW1pemF0aW9ucy5mb3JFYWNoKChzdmdDb250ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMub3B0aW1pemF0aW9uUXVldWUuaW5jbHVkZXMoc3ZnQ29udGVudCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wdGltaXphdGlvblF1ZXVlLnB1c2goc3ZnQ29udGVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnBlbmRpbmdPcHRpbWl6YXRpb25zLmNsZWFyKCk7XG5cbiAgICAgICAgLy8g5aSE55CG6Zif5YiX5Lit55qEU1ZH77yI6ZmQ5Yi25pWw6YeP77yJXG4gICAgICAgIGNvbnN0IHByb2Nlc3NDb3VudCA9IE1hdGgubWluKHRoaXMuYmF0Y2hPcHRpbWl6YXRpb25Db3VudCwgdGhpcy5vcHRpbWl6YXRpb25RdWV1ZS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvY2Vzc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHN2Z0NvbnRlbnQgPSB0aGlzLm9wdGltaXphdGlvblF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAoc3ZnQ29udGVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMub3B0aW1pemVTVkcoc3ZnQ29udGVudCkuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmiafooYzkvJjljJZcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHBlcmZvcm1PcHRpbWl6YXRpb24oc3ZnQ29udGVudDogc3RyaW5nLCBjb25maWc6IE9wdGltaXphdGlvbkNvbmZpZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIGxldCBvcHRpbWl6ZWRDb250ZW50ID0gc3ZnQ29udGVudDtcblxuICAgICAgICAvLyDlupTnlKjlkITnp43kvJjljJZcbiAgICAgICAgaWYgKGNvbmZpZy5yZW1vdmVDb21tZW50cykge1xuICAgICAgICAgICAgb3B0aW1pemVkQ29udGVudCA9IHRoaXMucmVtb3ZlQ29tbWVudHMob3B0aW1pemVkQ29udGVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLnJlbW92ZU1ldGFkYXRhKSB7XG4gICAgICAgICAgICBvcHRpbWl6ZWRDb250ZW50ID0gdGhpcy5yZW1vdmVNZXRhZGF0YShvcHRpbWl6ZWRDb250ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuZW5hYmxlUGF0aFNpbXBsaWZpY2F0aW9uKSB7XG4gICAgICAgICAgICBvcHRpbWl6ZWRDb250ZW50ID0gYXdhaXQgdGhpcy5zaW1wbGlmeVBhdGhzKG9wdGltaXplZENvbnRlbnQsIGNvbmZpZy5wYXRoU2ltcGxpZmljYXRpb25Ub2xlcmFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmZpZy5lbmFibGVDb2xvck9wdGltaXphdGlvbikge1xuICAgICAgICAgICAgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMub3B0aW1pemVDb2xvcnMob3B0aW1pemVkQ29udGVudCwgY29uZmlnLm1heENvbG9ycyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLnJlbW92ZVVudXNlZERlZnMpIHtcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLnJlbW92ZVVudXNlZERlZnMob3B0aW1pemVkQ29udGVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLm1lcmdlUGF0aHMpIHtcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSBhd2FpdCB0aGlzLm1lcmdlUGF0aHMob3B0aW1pemVkQ29udGVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLnByZWNpc2lvbiA+IDApIHtcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLnJvdW5kTnVtYmVycyhvcHRpbWl6ZWRDb250ZW50LCBjb25maWcucHJlY2lzaW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuZW5hYmxlQ29tcHJlc3Npb24pIHtcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLmNvbXByZXNzU1ZHKG9wdGltaXplZENvbnRlbnQsIGNvbmZpZy5jb21wcmVzc2lvbkxldmVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpbWl6ZWRDb250ZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOenu+mZpOazqOmHilxuICAgICAqL1xuICAgIHByaXZhdGUgcmVtb3ZlQ29tbWVudHMoc3ZnQ29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnQucmVwbGFjZSgvPCEtLVtcXHNcXFNdKj8tLT4vZywgXCJcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog56e76Zmk5YWD5pWw5o2uXG4gICAgICovXG4gICAgcHJpdmF0ZSByZW1vdmVNZXRhZGF0YShzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAvLyDnp7vpmaTlkITnp43lhYPmlbDmja7moIfnrb5cbiAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnRcbiAgICAgICAgICAgIC5yZXBsYWNlKC88bWV0YWRhdGE+W1xcc1xcU10qPzxcXC9tZXRhZGF0YT4vZywgXCJcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC88ZGVzYz5bXFxzXFxTXSo/PFxcL2Rlc2M+L2csIFwiXCIpXG4gICAgICAgICAgICAucmVwbGFjZSgvPHRpdGxlPltcXHNcXFNdKj88XFwvdGl0bGU+L2csIFwiXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOeugOWMlui3r+W+hFxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2ltcGxpZnlQYXRocyhzdmdDb250ZW50OiBzdHJpbmcsIHRvbGVyYW5jZTogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgLy8g6L+Z6YeM5bqU6K+l5L2/55So6Lev5b6E566A5YyW566X5rOVXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuWOn+Wni+WGheWuuVxuICAgICAgICByZXR1cm4gc3ZnQ29udGVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDkvJjljJbpopzoibJcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIG9wdGltaXplQ29sb3JzKHN2Z0NvbnRlbnQ6IHN0cmluZywgbWF4Q29sb3JzOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICAvLyDov5nph4zlupTor6Xlrp7njrDpopzoibLkvJjljJbnrpfms5VcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Y6f5aeL5YaF5a65XG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOenu+mZpOacquS9v+eUqOeahOWumuS5iVxuICAgICAqL1xuICAgIHByaXZhdGUgcmVtb3ZlVW51c2VkRGVmcyhzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAvLyDov5nph4zlupTor6XliIbmnpDlubbnp7vpmaTmnKrkvb/nlKjnmoQ8ZGVmcz7lhYPntKBcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Y6f5aeL5YaF5a65XG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOWQiOW5tui3r+W+hFxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgbWVyZ2VQYXRocyhzdmdDb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICAvLyDov5nph4zlupTor6Xlrp7njrDot6/lvoTlkIjlubbnrpfms5VcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Y6f5aeL5YaF5a65XG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOWbm+iIjeS6lOWFpeaVsOWtl1xuICAgICAqL1xuICAgIHByaXZhdGUgcm91bmROdW1iZXJzKHN2Z0NvbnRlbnQ6IHN0cmluZywgcHJlY2lzaW9uOiBudW1iZXIpOiBzdHJpbmcge1xuICAgICAgICAvLyDlm5voiI3kupTlhaVTVkfkuK3nmoTmlbDlrZdcbiAgICAgICAgY29uc3QgcmVnZXggPSAvKFxcZCtcXC5cXGQrKS9nO1xuICAgICAgICByZXR1cm4gc3ZnQ29udGVudC5yZXBsYWNlKHJlZ2V4LCAobWF0Y2gpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUZsb2F0KG1hdGNoKS50b0ZpeGVkKHByZWNpc2lvbik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOWOi+e8qVNWR1xuICAgICAqL1xuICAgIHByaXZhdGUgY29tcHJlc3NTVkcoc3ZnQ29udGVudDogc3RyaW5nLCBsZXZlbDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAgICAgLy8g566A5Y2V5Y6L57yp77ya56e76Zmk5aSa5L2Z56m655m9XG4gICAgICAgIHJldHVybiBzdmdDb250ZW50LnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnJlcGxhY2UoLz5cXHMrPC9nLCBcIj48XCIpLnRyaW0oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDlupTnlKjkvJjljJbnu5PmnpxcbiAgICAgKi9cbiAgICBwcml2YXRlIGFwcGx5T3B0aW1pemF0aW9uKHN2Z0NvbnRlbnQ6IHN0cmluZywgcmVzdWx0OiBPcHRpbWl6YXRpb25SZXN1bHQpOiBzdHJpbmcge1xuICAgICAgICAvLyDov5nph4zlupTor6XmoLnmja7kvJjljJbnu5PmnpzlupTnlKjlhbfkvZPlj5jljJZcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Y6f5aeL5YaF5a65XG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiOt+WPluS8mOWMluWPmOWMllxuICAgICAqL1xuICAgIHByaXZhdGUgZ2V0T3B0aW1pemF0aW9uQ2hhbmdlcyhvcmlnaW5hbDogc3RyaW5nLCBvcHRpbWl6ZWQ6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICAgICAgY29uc3QgY2hhbmdlczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICBpZiAob3JpZ2luYWwubGVuZ3RoICE9PSBvcHRpbWl6ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjaGFuZ2VzLnB1c2goYOWkp+WwjzogJHtvcmlnaW5hbC5sZW5ndGh9IC0+ICR7b3B0aW1pemVkLmxlbmd0aH0g5a2X6IqCYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDov5nph4zlj6/ku6Xmt7vliqDmm7TlpJrlj5jljJbmo4DmtYtcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Z+65pys5Y+Y5YyWXG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5pu05paw5oCn6IO957uf6K6hXG4gICAgICovXG4gICAgcHJpdmF0ZSB1cGRhdGVQZXJmb3JtYW5jZVN0YXRzKHJlc3VsdDogT3B0aW1pemF0aW9uUmVzdWx0KTogdm9pZCB7XG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbE9wdGltaXphdGlvbnMrKztcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLnRvdGFsUmVkdWN0aW9uICs9IHJlc3VsdC5yZWR1Y3Rpb25QZXJjZW50YWdlO1xuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxUaW1lICs9IHJlc3VsdC5vcHRpbWl6YXRpb25UaW1lO1xuXG4gICAgICAgIC8vIOiuoeeul+W5s+Wdh+WAvFxuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMuYXZlcmFnZVJlZHVjdGlvbiA9IHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbFJlZHVjdGlvbiAvIHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbE9wdGltaXphdGlvbnM7XG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5hdmVyYWdlVGltZSA9IHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbFRpbWUgLyB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxPcHRpbWl6YXRpb25zO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOS7jueyvueBteaPkOWPllNWR1xuICAgICAqL1xuICAgIHByaXZhdGUgZXh0cmFjdFNWR0Zyb21TcHJpdGUoc3ByaXRlOiBTcHJpdGUpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgLy8g6L+Z6YeM6ZyA6KaB5qC55o2u5a6e6ZmF6aG555uu57uT5p6E5o+Q5Y+WU1ZH5YaF5a65XG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuepulxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDorqHnrpflhYPmlbDmja7lpKflsI9cbiAgICAgKi9cbiAgICBwcml2YXRlIGNhbGN1bGF0ZU1ldGFkYXRhU2l6ZShzdmdDb250ZW50OiBzdHJpbmcpOiBudW1iZXIge1xuICAgICAgICBjb25zdCBtZXRhZGF0YU1hdGNoID0gc3ZnQ29udGVudC5tYXRjaCgvPG1ldGFkYXRhPltcXHNcXFNdKj88XFwvbWV0YWRhdGE+Lyk7XG4gICAgICAgIGNvbnN0IGRlc2NNYXRjaCA9IHN2Z0NvbnRlbnQubWF0Y2goLzxkZXNjPltcXHNcXFNdKj88XFwvZGVzYz4vKTtcbiAgICAgICAgY29uc3QgdGl0bGVNYXRjaCA9IHN2Z0NvbnRlbnQubWF0Y2goLzx0aXRsZT5bXFxzXFxTXSo/PFxcL3RpdGxlPi8pO1xuXG4gICAgICAgIGxldCB0b3RhbFNpemUgPSAwO1xuICAgICAgICBpZiAobWV0YWRhdGFNYXRjaCkgdG90YWxTaXplICs9IG1ldGFkYXRhTWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBpZiAoZGVzY01hdGNoKSB0b3RhbFNpemUgKz0gZGVzY01hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgaWYgKHRpdGxlTWF0Y2gpIHRvdGFsU2l6ZSArPSB0aXRsZU1hdGNoWzBdLmxlbmd0aDtcblxuICAgICAgICByZXR1cm4gdG90YWxTaXplO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOiuoeeul+azqOmHiuWkp+Wwj1xuICAgICAqL1xuICAgIHByaXZhdGUgY2FsY3VsYXRlQ29tbWVudFNpemUoc3ZnQ29udGVudDogc3RyaW5nKTogbnVtYmVyIHtcbiAgICAgICAgY29uc3QgY29tbWVudE1hdGNoZXMgPSBzdmdDb250ZW50Lm1hdGNoKC88IS0tW1xcc1xcU10qPy0tPi9nKTtcbiAgICAgICAgaWYgKCFjb21tZW50TWF0Y2hlcykgcmV0dXJuIDA7XG5cbiAgICAgICAgcmV0dXJuIGNvbW1lbnRNYXRjaGVzLnJlZHVjZSgodG90YWwsIGNvbW1lbnQpID0+IHRvdGFsICsgY29tbWVudC5sZW5ndGgsIDApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIOS8sOeul+a9nOWcqOWHj+WwkVxuICAgICAqL1xuICAgIHByaXZhdGUgZXN0aW1hdGVQb3RlbnRpYWxSZWR1Y3Rpb24oZGF0YToge1xuICAgICAgICBzaXplOiBudW1iZXI7XG4gICAgICAgIHBhdGhDb3VudDogbnVtYmVyO1xuICAgICAgICBjb2xvckNvdW50OiBudW1iZXI7XG4gICAgICAgIG1ldGFkYXRhU2l6ZTogbnVtYmVyO1xuICAgICAgICBjb21tZW50U2l6ZTogbnVtYmVyO1xuICAgIH0pOiBudW1iZXIge1xuICAgICAgICBsZXQgcG90ZW50aWFsUmVkdWN0aW9uID0gMDtcblxuICAgICAgICAvLyDln7rkuo7lhYPmlbDmja7nmoTlh4/lsJFcbiAgICAgICAgaWYgKGRhdGEubWV0YWRhdGFTaXplID4gMCkge1xuICAgICAgICAgICAgcG90ZW50aWFsUmVkdWN0aW9uICs9IChkYXRhLm1ldGFkYXRhU2l6ZSAvIGRhdGEuc2l6ZSkgKiAxMDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDln7rkuo7ms6jph4rnmoTlh4/lsJFcbiAgICAgICAgaWYgKGRhdGEuY29tbWVudFNpemUgPiAwKSB7XG4gICAgICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gKGRhdGEuY29tbWVudFNpemUgLyBkYXRhLnNpemUpICogMTAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5Z+65LqO6Lev5b6E5pWw6YeP55qE5YeP5bCR77yI5Lyw566X77yJXG4gICAgICAgIGlmIChkYXRhLnBhdGhDb3VudCA+IDEwKSB7XG4gICAgICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gTWF0aC5taW4oMjAsIGRhdGEucGF0aENvdW50ICogMC41KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWfuuS6juminOiJsuaVsOmHj+eahOWHj+Wwke+8iOS8sOeul++8iVxuICAgICAgICBpZiAoZGF0YS5jb2xvckNvdW50ID4gOCkge1xuICAgICAgICAgICAgcG90ZW50aWFsUmVkdWN0aW9uICs9IE1hdGgubWluKDE1LCAoZGF0YS5jb2xvckNvdW50IC0gOCkgKiAxLjUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5Y6L57yp5r2c5YqbXG4gICAgICAgIHBvdGVudGlhbFJlZHVjdGlvbiArPSAxMDsgLy8g5Z+65pys5Y6L57ypXG5cbiAgICAgICAgcmV0dXJuIE1hdGgubWluKDgwLCBwb3RlbnRpYWxSZWR1Y3Rpb24pOyAvLyDmnIDlpKflh4/lsJE4MCVcbiAgICB9XG59XG4iXX0=