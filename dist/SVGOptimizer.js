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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHT3B0aW1pemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL1NWR09wdGltaXplci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSwyQkFBbUQ7QUFDbkQsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBK0JsRTs7O0dBR0c7QUFJSSxJQUFNLFlBQVksR0FBbEIsTUFBTSxZQUFhLFNBQVEsY0FBUztJQUFwQztRQUNILDZCQUE2Qjs7UUFNckIsMkJBQXNCLEdBQVksSUFBSSxDQUFDO1FBTXZDLHVCQUFrQixHQUF1QjtZQUM3Qyx3QkFBd0IsRUFBRSxJQUFJO1lBQzlCLDJCQUEyQixFQUFFLEdBQUc7WUFDaEMsdUJBQXVCLEVBQUUsSUFBSTtZQUM3QixTQUFTLEVBQUUsRUFBRTtZQUNiLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixjQUFjLEVBQUUsSUFBSTtZQUNwQixjQUFjLEVBQUUsSUFBSTtZQUNwQixnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFNBQVMsRUFBRSxDQUFDO1NBQ2YsQ0FBQztRQVFNLDBCQUFxQixHQUFXLEVBQUUsQ0FBQyxDQUFDLE9BQU87UUFRM0MsMkJBQXNCLEdBQVcsRUFBRSxDQUFDO1FBRTVDLDZCQUE2QjtRQU1yQixnQ0FBMkIsR0FBWSxLQUFLLENBQUM7UUFRN0MscUJBQWdCLEdBQVcsR0FBRyxDQUFDO1FBRXZDLDZCQUE2QjtRQUVyQixzQkFBaUIsR0FBb0MsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFNBQVM7UUFDekUseUJBQW9CLEdBQWdCLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxTQUFTO1FBQ3hELHNCQUFpQixHQUFhLEVBQUUsQ0FBQyxDQUFDLE9BQU87UUFFekMscUJBQWdCLEdBQUc7WUFDdkIsa0JBQWtCLEVB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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50LCBTcHJpdGUgfSBmcm9tIFwiY2NcIjtcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIG1lbnUgfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5cclxuLyoqXHJcbiAqIOS8mOWMlumFjee9rlxyXG4gKi9cclxuaW50ZXJmYWNlIE9wdGltaXphdGlvbkNvbmZpZyB7XHJcbiAgICBlbmFibGVQYXRoU2ltcGxpZmljYXRpb246IGJvb2xlYW47IC8vIOWQr+eUqOi3r+W+hOeugOWMllxyXG4gICAgcGF0aFNpbXBsaWZpY2F0aW9uVG9sZXJhbmNlOiBudW1iZXI7IC8vIOi3r+W+hOeugOWMluWuueW3ru+8iDAtMe+8iVxyXG4gICAgZW5hYmxlQ29sb3JPcHRpbWl6YXRpb246IGJvb2xlYW47IC8vIOWQr+eUqOminOiJsuS8mOWMllxyXG4gICAgbWF4Q29sb3JzOiBudW1iZXI7IC8vIOacgOWkp+minOiJsuaVsOmHj1xyXG4gICAgZW5hYmxlQ29tcHJlc3Npb246IGJvb2xlYW47IC8vIOWQr+eUqOWOi+e8qVxyXG4gICAgY29tcHJlc3Npb25MZXZlbDogbnVtYmVyOyAvLyDljovnvKnnuqfliKvvvIgwLTnvvIlcclxuICAgIHJlbW92ZU1ldGFkYXRhOiBib29sZWFuOyAvLyDnp7vpmaTlhYPmlbDmja5cclxuICAgIHJlbW92ZUNvbW1lbnRzOiBib29sZWFuOyAvLyDnp7vpmaTms6jph4pcclxuICAgIHJlbW92ZVVudXNlZERlZnM6IGJvb2xlYW47IC8vIOenu+mZpOacquS9v+eUqOeahOWumuS5iVxyXG4gICAgbWVyZ2VQYXRoczogYm9vbGVhbjsgLy8g5ZCI5bm26Lev5b6EXHJcbiAgICBwcmVjaXNpb246IG51bWJlcjsgLy8g5pWw5YC857K+5bqm77yI5bCP5pWw54K55ZCO5L2N5pWw77yJXHJcbn1cclxuXHJcbi8qKlxyXG4gKiDkvJjljJbnu5PmnpxcclxuICovXHJcbmludGVyZmFjZSBPcHRpbWl6YXRpb25SZXN1bHQge1xyXG4gICAgb3JpZ2luYWxTaXplOiBudW1iZXI7IC8vIOWOn+Wni+Wkp+Wwj++8iOWtl+iKgu+8iVxyXG4gICAgb3B0aW1pemVkU2l6ZTogbnVtYmVyOyAvLyDkvJjljJblkI7lpKflsI/vvIjlrZfoioLvvIlcclxuICAgIHJlZHVjdGlvblBlcmNlbnRhZ2U6IG51bWJlcjsgLy8g5YeP5bCR55m+5YiG5q+UXHJcbiAgICBvcHRpbWl6YXRpb25UaW1lOiBudW1iZXI7IC8vIOS8mOWMluaXtumXtO+8iOavq+enku+8iVxyXG4gICAgY2hhbmdlczogc3RyaW5nW107IC8vIOWFt+S9k+WPmOWMllxyXG59XHJcblxyXG4vKipcclxuICogU1ZH5LyY5YyW5ZmoXHJcbiAqIOaPkOS+m+WQhOenjVNWR+S8mOWMluWKn+iDve+8jOWmgui3r+W+hOeugOWMluOAgeminOiJsuS8mOWMluOAgeWOi+e8qeetiVxyXG4gKi9cclxuQGNjY2xhc3MoXCJTVkdPcHRpbWl6ZXJcIilcclxuQG1lbnUoXCIyRC9TVkdPcHRpbWl6ZXJcIilcclxuQGV4ZWN1dGVJbkVkaXRNb2RlXHJcbmV4cG9ydCBjbGFzcyBTVkdPcHRpbWl6ZXIgZXh0ZW5kcyBDb21wb25lbnQge1xyXG4gICAgLy8gPT09PT09PT09PSDkvJjljJbphY3nva4gPT09PT09PT09PVxyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLlkK/nlKjoh6rliqjkvJjljJZcIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLoh6rliqjkvJjljJZcIixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIGVuYWJsZUF1dG9PcHRpbWl6YXRpb246IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCLkvJjljJbphY3nva5cIixcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLkvJjljJbphY3nva5cIixcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIG9wdGltaXphdGlvbkNvbmZpZzogT3B0aW1pemF0aW9uQ29uZmlnID0ge1xyXG4gICAgICAgIGVuYWJsZVBhdGhTaW1wbGlmaWNhdGlvbjogdHJ1ZSxcclxuICAgICAgICBwYXRoU2ltcGxpZmljYXRpb25Ub2xlcmFuY2U6IDAuMSxcclxuICAgICAgICBlbmFibGVDb2xvck9wdGltaXphdGlvbjogdHJ1ZSxcclxuICAgICAgICBtYXhDb2xvcnM6IDE2LFxyXG4gICAgICAgIGVuYWJsZUNvbXByZXNzaW9uOiB0cnVlLFxyXG4gICAgICAgIGNvbXByZXNzaW9uTGV2ZWw6IDYsXHJcbiAgICAgICAgcmVtb3ZlTWV0YWRhdGE6IHRydWUsXHJcbiAgICAgICAgcmVtb3ZlQ29tbWVudHM6IHRydWUsXHJcbiAgICAgICAgcmVtb3ZlVW51c2VkRGVmczogdHJ1ZSxcclxuICAgICAgICBtZXJnZVBhdGhzOiB0cnVlLFxyXG4gICAgICAgIHByZWNpc2lvbjogMyxcclxuICAgIH07XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuS8mOWMlumYiOWAvO+8iEtC77yJXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5LyY5YyW6ZiI5YC8XCIsXHJcbiAgICAgICAgbWluOiAxLFxyXG4gICAgICAgIG1heDogMTAwMCxcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIG9wdGltaXphdGlvblRocmVzaG9sZDogbnVtYmVyID0gMTA7IC8vIDEwS0JcclxuXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHRvb2x0aXA6IFwi5om56YeP5LyY5YyW5pWw6YePXCIsXHJcbiAgICAgICAgZGlzcGxheU5hbWU6IFwi5om56YeP5LyY5YyW5pWwXCIsXHJcbiAgICAgICAgbWluOiAxLFxyXG4gICAgICAgIG1heDogNTAsXHJcbiAgICB9KVxyXG4gICAgcHJpdmF0ZSBiYXRjaE9wdGltaXphdGlvbkNvdW50OiBudW1iZXIgPSAxMDtcclxuXHJcbiAgICAvLyA9PT09PT09PT09IOaAp+iDvemFjee9riA9PT09PT09PT09XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuWQr+eUqOaAp+iDveebkeaOp1wiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuaAp+iDveebkeaOp1wiLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgZW5hYmxlUGVyZm9ybWFuY2VNb25pdG9yaW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIuacgOWkp+e8k+WtmOS8mOWMlue7k+aenFwiLFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIuacgOWkp+e8k+WtmFwiLFxyXG4gICAgICAgIG1pbjogMTAsXHJcbiAgICAgICAgbWF4OiAxMDAwLFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgbWF4Q2FjaGVkUmVzdWx0czogbnVtYmVyID0gMTAwO1xyXG5cclxuICAgIC8vID09PT09PT09PT0g5YaF6YOo54q25oCBID09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIG9wdGltaXphdGlvbkNhY2hlOiBNYXA8c3RyaW5nLCBPcHRpbWl6YXRpb25SZXN1bHQ+ID0gbmV3IE1hcCgpOyAvLyDkvJjljJbnu5PmnpznvJPlrZhcclxuICAgIHByaXZhdGUgcGVuZGluZ09wdGltaXphdGlvbnM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpOyAvLyDlvoXkvJjljJZTVkdcclxuICAgIHByaXZhdGUgb3B0aW1pemF0aW9uUXVldWU6IHN0cmluZ1tdID0gW107IC8vIOS8mOWMlumYn+WIl1xyXG5cclxuICAgIHByaXZhdGUgcGVyZm9ybWFuY2VTdGF0cyA9IHtcclxuICAgICAgICB0b3RhbE9wdGltaXphdGlvbnM6IDAsXHJcbiAgICAgICAgdG90YWxSZWR1Y3Rpb246IDAsXHJcbiAgICAgICAgYXZlcmFnZVJlZHVjdGlvbjogMCxcclxuICAgICAgICB0b3RhbFRpbWU6IDAsXHJcbiAgICAgICAgYXZlcmFnZVRpbWU6IDAsXHJcbiAgICAgICAgY2FjaGVIaXRzOiAwLFxyXG4gICAgICAgIGNhY2hlTWlzc2VzOiAwLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09IOeUn+WRveWRqOacn+aWueazlSA9PT09PT09PT09XHJcblxyXG4gICAgb25Mb2FkKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZU9wdGltaXplcigpO1xyXG4gICAgfVxyXG5cclxuICAgIG9uRGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLmNsZWFudXBPcHRpbWl6ZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZGVsdGFUaW1lOiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5lbmFibGVBdXRvT3B0aW1pemF0aW9uICYmIHRoaXMucGVuZGluZ09wdGltaXphdGlvbnMuc2l6ZSA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy5wcm9jZXNzUGVuZGluZ09wdGltaXphdGlvbnMoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDlhazlhbHmlrnms5UgPT09PT09PT09PVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LyY5YyWU1ZH5YaF5a65XHJcbiAgICAgKiBAcGFyYW0gc3ZnQ29udGVudCBTVkflhoXlrrlcclxuICAgICAqIEBwYXJhbSBjb25maWcg5LyY5YyW6YWN572u77yI5Y+v6YCJ77yM5L2/55So6buY6K6k6YWN572u77yJXHJcbiAgICAgKiBAcmV0dXJucyDkvJjljJblkI7nmoRTVkflhoXlrrlcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIG9wdGltaXplU1ZHKHN2Z0NvbnRlbnQ6IHN0cmluZywgY29uZmlnPzogT3B0aW1pemF0aW9uQ29uZmlnKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgICAgICBjb25zdCBjYWNoZUtleSA9IHRoaXMuZ2VuZXJhdGVDYWNoZUtleShzdmdDb250ZW50LCBjb25maWcgfHwgdGhpcy5vcHRpbWl6YXRpb25Db25maWcpO1xyXG5cclxuICAgICAgICAvLyDmo4Dmn6XnvJPlrZhcclxuICAgICAgICBpZiAodGhpcy5vcHRpbWl6YXRpb25DYWNoZS5oYXMoY2FjaGVLZXkpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5jYWNoZUhpdHMrKztcclxuICAgICAgICAgICAgY29uc3QgY2FjaGVkUmVzdWx0ID0gdGhpcy5vcHRpbWl6YXRpb25DYWNoZS5nZXQoY2FjaGVLZXkpITtcclxuXHJcbiAgICAgICAgICAgIC8vIOabtOaWsOe8k+WtmOiuv+mXruaXtumXtO+8iExSVeetlueVpe+8iVxyXG4gICAgICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmRlbGV0ZShjYWNoZUtleSk7XHJcbiAgICAgICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuc2V0KGNhY2hlS2V5LCBjYWNoZWRSZXN1bHQpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwbHlPcHRpbWl6YXRpb24oc3ZnQ29udGVudCwgY2FjaGVkUmVzdWx0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5jYWNoZU1pc3NlcysrO1xyXG5cclxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU2l6ZSA9IHN2Z0NvbnRlbnQubGVuZ3RoO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyDmiafooYzkvJjljJZcclxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMucGVyZm9ybU9wdGltaXphdGlvbihzdmdDb250ZW50LCBjb25maWcgfHwgdGhpcy5vcHRpbWl6YXRpb25Db25maWcpO1xyXG4gICAgICAgICAgICBjb25zdCBvcHRpbWl6ZWRTaXplID0gb3B0aW1pemVkQ29udGVudC5sZW5ndGg7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZHVjdGlvblBlcmNlbnRhZ2UgPSAoKG9yaWdpbmFsU2l6ZSAtIG9wdGltaXplZFNpemUpIC8gb3JpZ2luYWxTaXplKSAqIDEwMDtcclxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemF0aW9uVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IE9wdGltaXphdGlvblJlc3VsdCA9IHtcclxuICAgICAgICAgICAgICAgIG9yaWdpbmFsU2l6ZSxcclxuICAgICAgICAgICAgICAgIG9wdGltaXplZFNpemUsXHJcbiAgICAgICAgICAgICAgICByZWR1Y3Rpb25QZXJjZW50YWdlLFxyXG4gICAgICAgICAgICAgICAgb3B0aW1pemF0aW9uVGltZSxcclxuICAgICAgICAgICAgICAgIGNoYW5nZXM6IHRoaXMuZ2V0T3B0aW1pemF0aW9uQ2hhbmdlcyhzdmdDb250ZW50LCBvcHRpbWl6ZWRDb250ZW50KSxcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8vIOe8k+WtmOe7k+aenFxyXG4gICAgICAgICAgICB0aGlzLmNhY2hlT3B0aW1pemF0aW9uUmVzdWx0KGNhY2hlS2V5LCByZXN1bHQpO1xyXG5cclxuICAgICAgICAgICAgLy8g5pu05paw5oCn6IO957uf6K6hXHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUGVyZm9ybWFuY2VTdGF0cyhyZXN1bHQpO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFNWR+S8mOWMluWujOaIkDog5YeP5bCRICR7cmVkdWN0aW9uUGVyY2VudGFnZS50b0ZpeGVkKDIpfSUgKCR7b3JpZ2luYWxTaXplfSAtPiAke29wdGltaXplZFNpemV9IOWtl+iKgilgKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBvcHRpbWl6ZWRDb250ZW50O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJTVkfkvJjljJblpLHotKU6XCIsIGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnQ7IC8vIOWksei0peaXtui/lOWbnuWOn+Wni+WGheWuuVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOaJuemHj+S8mOWMllNWR1xyXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnRzIFNWR+WGheWuueaVsOe7hFxyXG4gICAgICogQHBhcmFtIGNvbmZpZyDkvJjljJbphY3nva7vvIjlj6/pgInvvIlcclxuICAgICAqIEByZXR1cm5zIOS8mOWMluWQjueahFNWR+WGheWuueaVsOe7hFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgYmF0Y2hPcHRpbWl6ZVNWRyhzdmdDb250ZW50czogc3RyaW5nW10sIGNvbmZpZz86IE9wdGltaXphdGlvbkNvbmZpZyk6IFByb21pc2U8c3RyaW5nW10+IHtcclxuICAgICAgICBjb25zdCBwcm9taXNlcyA9IHN2Z0NvbnRlbnRzLm1hcCgoc3ZnQ29udGVudCkgPT4gdGhpcy5vcHRpbWl6ZVNWRyhzdmdDb250ZW50LCBjb25maWcpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS8mOWMlueyvueBteeahFNWR1xyXG4gICAgICogQHBhcmFtIHNwcml0ZSDnsr7ngbXnu4Tku7ZcclxuICAgICAqIEBwYXJhbSBjb25maWcg5LyY5YyW6YWN572u77yI5Y+v6YCJ77yJXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhc3luYyBvcHRpbWl6ZVNwcml0ZVNWRyhzcHJpdGU6IFNwcml0ZSwgY29uZmlnPzogT3B0aW1pemF0aW9uQ29uZmlnKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKCFzcHJpdGUgfHwgIXNwcml0ZS5zcHJpdGVGcmFtZSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLnsr7ngbXmiJbnsr7ngbXluKfml6DmlYhcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOi/memHjOmcgOimgeS7jueyvueBteiOt+WPllNWR+WGheWuuVxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muWBh+iuvueyvueBteaciVNWR+WGheWuueWxnuaAp1xyXG4gICAgICAgIGNvbnN0IHN2Z0NvbnRlbnQgPSB0aGlzLmV4dHJhY3RTVkdGcm9tU3ByaXRlKHNwcml0ZSk7XHJcbiAgICAgICAgaWYgKCFzdmdDb250ZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuaXoOazleS7jueyvueBteiOt+WPllNWR+WGheWuuVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5LyY5YyWU1ZHXHJcbiAgICAgICAgY29uc3Qgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMub3B0aW1pemVTVkcoc3ZnQ29udGVudCwgY29uZmlnKTtcclxuXHJcbiAgICAgICAgLy8g5pu05paw57K+54G177yI6L+Z6YeM6ZyA6KaB5qC55o2u5a6e6ZmF6aG555uu57uT5p6E5a6e546w77yJXHJcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6K6w5b2V5LyY5YyW57uT5p6cXHJcbiAgICAgICAgY29uc29sZS5sb2coYOeyvueBtVNWR+S8mOWMluWujOaIkDogJHtzcHJpdGUubm9kZT8ubmFtZSB8fCBcIuacquefpeeyvueBtVwifWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5LyY5YyW57uf6K6hXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBnZXRPcHRpbWl6YXRpb25TdGF0cygpOiB0eXBlb2YgdGhpcy5wZXJmb3JtYW5jZVN0YXRzIHtcclxuICAgICAgICByZXR1cm4geyAuLi50aGlzLnBlcmZvcm1hbmNlU3RhdHMgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOa4hemZpOS8mOWMlue8k+WtmFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY2xlYXJPcHRpbWl6YXRpb25DYWNoZSgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmNsZWFyKCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCLkvJjljJbnvJPlrZjlt7LmuIXpmaRcIik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bnvJPlrZjkv6Hmga9cclxuICAgICAqL1xyXG4gICAgcHVibGljIGdldENhY2hlSW5mbygpOiB7XHJcbiAgICAgICAgc2l6ZTogbnVtYmVyO1xyXG4gICAgICAgIGhpdFJhdGU6IG51bWJlcjtcclxuICAgICAgICB0b3RhbFNpemU6IG51bWJlcjtcclxuICAgIH0ge1xyXG4gICAgICAgIGNvbnN0IHRvdGFsU2l6ZSA9IEFycmF5LmZyb20odGhpcy5vcHRpbWl6YXRpb25DYWNoZS52YWx1ZXMoKSkucmVkdWNlKChzdW0sIHJlc3VsdCkgPT4gc3VtICsgcmVzdWx0Lm9wdGltaXplZFNpemUsIDApO1xyXG5cclxuICAgICAgICBjb25zdCB0b3RhbEFjY2Vzc2VzID0gdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmNhY2hlSGl0cyArIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5jYWNoZU1pc3NlcztcclxuICAgICAgICBjb25zdCBoaXRSYXRlID0gdG90YWxBY2Nlc3NlcyA+IDAgPyAodGhpcy5wZXJmb3JtYW5jZVN0YXRzLmNhY2hlSGl0cyAvIHRvdGFsQWNjZXNzZXMpICogMTAwIDogMDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc2l6ZTogdGhpcy5vcHRpbWl6YXRpb25DYWNoZS5zaXplLFxyXG4gICAgICAgICAgICBoaXRSYXRlLFxyXG4gICAgICAgICAgICB0b3RhbFNpemUsXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiuvue9ruS8mOWMlumFjee9rlxyXG4gICAgICogQHBhcmFtIGNvbmZpZyDmlrDnmoTkvJjljJbphY3nva5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHNldE9wdGltaXphdGlvbkNvbmZpZyhjb25maWc6IE9wdGltaXphdGlvbkNvbmZpZyk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ29uZmlnID0gY29uZmlnO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwi5LyY5YyW6YWN572u5bey5pu05pawXCIpO1xyXG5cclxuICAgICAgICAvLyDmuIXpmaTnvJPlrZjvvIzlm6DkuLrphY3nva7lt7Lmm7TmlLlcclxuICAgICAgICB0aGlzLmNsZWFyT3B0aW1pemF0aW9uQ2FjaGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIhuaekFNWR+S8mOWMlua9nOWKm1xyXG4gICAgICogQHBhcmFtIHN2Z0NvbnRlbnQgU1ZH5YaF5a65XHJcbiAgICAgKiBAcmV0dXJucyDkvJjljJbmvZzlipvliIbmnpBcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFuYWx5emVPcHRpbWl6YXRpb25Qb3RlbnRpYWwoc3ZnQ29udGVudDogc3RyaW5nKToge1xyXG4gICAgICAgIHNpemU6IG51bWJlcjtcclxuICAgICAgICBwYXRoQ291bnQ6IG51bWJlcjtcclxuICAgICAgICBjb2xvckNvdW50OiBudW1iZXI7XHJcbiAgICAgICAgbWV0YWRhdGFTaXplOiBudW1iZXI7XHJcbiAgICAgICAgY29tbWVudFNpemU6IG51bWJlcjtcclxuICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb246IG51bWJlcjtcclxuICAgIH0ge1xyXG4gICAgICAgIGNvbnN0IHNpemUgPSBzdmdDb250ZW50Lmxlbmd0aDtcclxuXHJcbiAgICAgICAgLy8g5YiG5p6Q6Lev5b6E5pWw6YePXHJcbiAgICAgICAgY29uc3QgcGF0aENvdW50ID0gKHN2Z0NvbnRlbnQubWF0Y2goLzxwYXRoL2cpIHx8IFtdKS5sZW5ndGg7XHJcblxyXG4gICAgICAgIC8vIOWIhuaekOminOiJsuaVsOmHj1xyXG4gICAgICAgIGNvbnN0IGNvbG9yTWF0Y2hlcyA9IHN2Z0NvbnRlbnQubWF0Y2goLyNbMC05YS1mQS1GXXszLDZ9fHJnYlxcKFteKV0rXFwpfHJnYmFcXChbXildK1xcKS9nKSB8fCBbXTtcclxuICAgICAgICBjb25zdCBjb2xvckNvdW50ID0gbmV3IFNldChjb2xvck1hdGNoZXMpLnNpemU7XHJcblxyXG4gICAgICAgIC8vIOWIhuaekOWFg+aVsOaNruWkp+Wwj1xyXG4gICAgICAgIGNvbnN0IG1ldGFkYXRhU2l6ZSA9IHRoaXMuY2FsY3VsYXRlTWV0YWRhdGFTaXplKHN2Z0NvbnRlbnQpO1xyXG5cclxuICAgICAgICAvLyDliIbmnpDms6jph4rlpKflsI9cclxuICAgICAgICBjb25zdCBjb21tZW50U2l6ZSA9IHRoaXMuY2FsY3VsYXRlQ29tbWVudFNpemUoc3ZnQ29udGVudCk7XHJcblxyXG4gICAgICAgIC8vIOS8sOeul+a9nOWcqOWHj+WwkVxyXG4gICAgICAgIGNvbnN0IHBvdGVudGlhbFJlZHVjdGlvbiA9IHRoaXMuZXN0aW1hdGVQb3RlbnRpYWxSZWR1Y3Rpb24oe1xyXG4gICAgICAgICAgICBzaXplLFxyXG4gICAgICAgICAgICBwYXRoQ291bnQsXHJcbiAgICAgICAgICAgIGNvbG9yQ291bnQsXHJcbiAgICAgICAgICAgIG1ldGFkYXRhU2l6ZSxcclxuICAgICAgICAgICAgY29tbWVudFNpemUsXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHNpemUsXHJcbiAgICAgICAgICAgIHBhdGhDb3VudCxcclxuICAgICAgICAgICAgY29sb3JDb3VudCxcclxuICAgICAgICAgICAgbWV0YWRhdGFTaXplLFxyXG4gICAgICAgICAgICBjb21tZW50U2l6ZSxcclxuICAgICAgICAgICAgcG90ZW50aWFsUmVkdWN0aW9uLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT09PT09PT09PSDnp4HmnInmlrnms5UgPT09PT09PT09PVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yid5aeL5YyW5LyY5YyW5ZmoXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZU9wdGltaXplcigpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLm9wdGltaXphdGlvbkNhY2hlLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5wZW5kaW5nT3B0aW1pemF0aW9ucy5jbGVhcigpO1xyXG4gICAgICAgIHRoaXMub3B0aW1pemF0aW9uUXVldWUgPSBbXTtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coXCJTVkdPcHRpbWl6ZXIg5Yid5aeL5YyW5a6M5oiQXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5riF55CG5LyY5YyW5ZmoXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2xlYW51cE9wdGltaXplcigpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmNsZWFyT3B0aW1pemF0aW9uQ2FjaGUoKTtcclxuICAgICAgICB0aGlzLnBlbmRpbmdPcHRpbWl6YXRpb25zLmNsZWFyKCk7XHJcbiAgICAgICAgdGhpcy5vcHRpbWl6YXRpb25RdWV1ZSA9IFtdO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcIlNWR09wdGltaXplciDmuIXnkIblrozmiJBcIik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnlJ/miJDnvJPlrZjplK5cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUNhY2hlS2V5KHN2Z0NvbnRlbnQ6IHN0cmluZywgY29uZmlnOiBPcHRpbWl6YXRpb25Db25maWcpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IGNvbmZpZ0hhc2ggPSBKU09OLnN0cmluZ2lmeShjb25maWcpO1xyXG4gICAgICAgIGNvbnN0IGNvbnRlbnRIYXNoID0gdGhpcy5jYWxjdWxhdGVDb250ZW50SGFzaChzdmdDb250ZW50KTtcclxuICAgICAgICByZXR1cm4gYCR7Y29udGVudEhhc2h9XyR7Y29uZmlnSGFzaH1gO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6h566X5YaF5a655ZOI5biMXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2FsY3VsYXRlQ29udGVudEhhc2goY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICAvLyDnroDljZXlk4jluIzlh73mlbBcclxuICAgICAgICBsZXQgaGFzaCA9IDA7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb250ZW50Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSBjb250ZW50LmNoYXJDb2RlQXQoaSk7XHJcbiAgICAgICAgICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBjaGFyO1xyXG4gICAgICAgICAgICBoYXNoID0gaGFzaCAmIGhhc2g7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBNYXRoLmFicyhoYXNoKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDAsIDgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog57yT5a2Y5LyY5YyW57uT5p6cXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgY2FjaGVPcHRpbWl6YXRpb25SZXN1bHQoa2V5OiBzdHJpbmcsIHJlc3VsdDogT3B0aW1pemF0aW9uUmVzdWx0KTogdm9pZCB7XHJcbiAgICAgICAgLy8g5qOA5p+l57yT5a2Y5aSn5bCP6ZmQ5Yi2XHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuc2l6ZSA+PSB0aGlzLm1heENhY2hlZFJlc3VsdHMpIHtcclxuICAgICAgICAgICAgLy8gTFJV562W55Wl77ya56e76Zmk5pyA5pep55qE6aG555uuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0S2V5ID0gdGhpcy5vcHRpbWl6YXRpb25DYWNoZS5rZXlzKCkubmV4dCgpLnZhbHVlO1xyXG4gICAgICAgICAgICBpZiAoZmlyc3RLZXkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMub3B0aW1pemF0aW9uQ2FjaGUuZGVsZXRlKGZpcnN0S2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5vcHRpbWl6YXRpb25DYWNoZS5zZXQoa2V5LCByZXN1bHQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5aSE55CG5b6F5LyY5YyWU1ZHXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcHJvY2Vzc1BlbmRpbmdPcHRpbWl6YXRpb25zKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLnBlbmRpbmdPcHRpbWl6YXRpb25zLnNpemUgPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g5bCG5b6F5LyY5YyWU1ZH5re75Yqg5Yiw6Zif5YiXXHJcbiAgICAgICAgdGhpcy5wZW5kaW5nT3B0aW1pemF0aW9ucy5mb3JFYWNoKChzdmdDb250ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5vcHRpbWl6YXRpb25RdWV1ZS5pbmNsdWRlcyhzdmdDb250ZW50KSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpbWl6YXRpb25RdWV1ZS5wdXNoKHN2Z0NvbnRlbnQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5wZW5kaW5nT3B0aW1pemF0aW9ucy5jbGVhcigpO1xyXG5cclxuICAgICAgICAvLyDlpITnkIbpmJ/liJfkuK3nmoRTVkfvvIjpmZDliLbmlbDph4/vvIlcclxuICAgICAgICBjb25zdCBwcm9jZXNzQ291bnQgPSBNYXRoLm1pbih0aGlzLmJhdGNoT3B0aW1pemF0aW9uQ291bnQsIHRoaXMub3B0aW1pemF0aW9uUXVldWUubGVuZ3RoKTtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcm9jZXNzQ291bnQ7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBzdmdDb250ZW50ID0gdGhpcy5vcHRpbWl6YXRpb25RdWV1ZS5zaGlmdCgpO1xyXG4gICAgICAgICAgICBpZiAoc3ZnQ29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpbWl6ZVNWRyhzdmdDb250ZW50KS5jYXRjaChjb25zb2xlLmVycm9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOaJp+ihjOS8mOWMllxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIHBlcmZvcm1PcHRpbWl6YXRpb24oc3ZnQ29udGVudDogc3RyaW5nLCBjb25maWc6IE9wdGltaXphdGlvbkNvbmZpZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICAgICAgbGV0IG9wdGltaXplZENvbnRlbnQgPSBzdmdDb250ZW50O1xyXG5cclxuICAgICAgICAvLyDlupTnlKjlkITnp43kvJjljJZcclxuICAgICAgICBpZiAoY29uZmlnLnJlbW92ZUNvbW1lbnRzKSB7XHJcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLnJlbW92ZUNvbW1lbnRzKG9wdGltaXplZENvbnRlbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbmZpZy5yZW1vdmVNZXRhZGF0YSkge1xyXG4gICAgICAgICAgICBvcHRpbWl6ZWRDb250ZW50ID0gdGhpcy5yZW1vdmVNZXRhZGF0YShvcHRpbWl6ZWRDb250ZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjb25maWcuZW5hYmxlUGF0aFNpbXBsaWZpY2F0aW9uKSB7XHJcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSBhd2FpdCB0aGlzLnNpbXBsaWZ5UGF0aHMob3B0aW1pemVkQ29udGVudCwgY29uZmlnLnBhdGhTaW1wbGlmaWNhdGlvblRvbGVyYW5jZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY29uZmlnLmVuYWJsZUNvbG9yT3B0aW1pemF0aW9uKSB7XHJcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSBhd2FpdCB0aGlzLm9wdGltaXplQ29sb3JzKG9wdGltaXplZENvbnRlbnQsIGNvbmZpZy5tYXhDb2xvcnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbmZpZy5yZW1vdmVVbnVzZWREZWZzKSB7XHJcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLnJlbW92ZVVudXNlZERlZnMob3B0aW1pemVkQ29udGVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY29uZmlnLm1lcmdlUGF0aHMpIHtcclxuICAgICAgICAgICAgb3B0aW1pemVkQ29udGVudCA9IGF3YWl0IHRoaXMubWVyZ2VQYXRocyhvcHRpbWl6ZWRDb250ZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChjb25maWcucHJlY2lzaW9uID4gMCkge1xyXG4gICAgICAgICAgICBvcHRpbWl6ZWRDb250ZW50ID0gdGhpcy5yb3VuZE51bWJlcnMob3B0aW1pemVkQ29udGVudCwgY29uZmlnLnByZWNpc2lvbik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY29uZmlnLmVuYWJsZUNvbXByZXNzaW9uKSB7XHJcbiAgICAgICAgICAgIG9wdGltaXplZENvbnRlbnQgPSB0aGlzLmNvbXByZXNzU1ZHKG9wdGltaXplZENvbnRlbnQsIGNvbmZpZy5jb21wcmVzc2lvbkxldmVsKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBvcHRpbWl6ZWRDb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog56e76Zmk5rOo6YeKXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVtb3ZlQ29tbWVudHMoc3ZnQ29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gc3ZnQ29udGVudC5yZXBsYWNlKC88IS0tW1xcc1xcU10qPy0tPi9nLCBcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOenu+mZpOWFg+aVsOaNrlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHJlbW92ZU1ldGFkYXRhKHN2Z0NvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgLy8g56e76Zmk5ZCE56eN5YWD5pWw5o2u5qCH562+XHJcbiAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnRcclxuICAgICAgICAgICAgLnJlcGxhY2UoLzxtZXRhZGF0YT5bXFxzXFxTXSo/PFxcL21ldGFkYXRhPi9nLCBcIlwiKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvPGRlc2M+W1xcc1xcU10qPzxcXC9kZXNjPi9nLCBcIlwiKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgvPHRpdGxlPltcXHNcXFNdKj88XFwvdGl0bGU+L2csIFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog566A5YyW6Lev5b6EXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgc2ltcGxpZnlQYXRocyhzdmdDb250ZW50OiBzdHJpbmcsIHRvbGVyYW5jZTogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgICAgICAvLyDov5nph4zlupTor6Xkvb/nlKjot6/lvoTnroDljJbnrpfms5VcclxuICAgICAgICAvLyDnroDljJblrp7njrDvvJrov5Tlm57ljp/lp4vlhoXlrrlcclxuICAgICAgICByZXR1cm4gc3ZnQ29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS8mOWMluminOiJslxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIG9wdGltaXplQ29sb3JzKHN2Z0NvbnRlbnQ6IHN0cmluZywgbWF4Q29sb3JzOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgICAgIC8vIOi/memHjOW6lOivpeWunueOsOminOiJsuS8mOWMlueul+azlVxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuWOn+Wni+WGheWuuVxyXG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog56e76Zmk5pyq5L2/55So55qE5a6a5LmJXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVtb3ZlVW51c2VkRGVmcyhzdmdDb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIC8vIOi/memHjOW6lOivpeWIhuaekOW5tuenu+mZpOacquS9v+eUqOeahDxkZWZzPuWFg+e0oFxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuWOn+Wni+WGheWuuVxyXG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZCI5bm26Lev5b6EXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgbWVyZ2VQYXRocyhzdmdDb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgICAgIC8vIOi/memHjOW6lOivpeWunueOsOi3r+W+hOWQiOW5tueul+azlVxyXG4gICAgICAgIC8vIOeugOWMluWunueOsO+8mui/lOWbnuWOn+Wni+WGheWuuVxyXG4gICAgICAgIHJldHVybiBzdmdDb250ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Zub6IiN5LqU5YWl5pWw5a2XXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcm91bmROdW1iZXJzKHN2Z0NvbnRlbnQ6IHN0cmluZywgcHJlY2lzaW9uOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgICAgIC8vIOWbm+iIjeS6lOWFpVNWR+S4reeahOaVsOWtl1xyXG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gLyhcXGQrXFwuXFxkKykvZztcclxuICAgICAgICByZXR1cm4gc3ZnQ29udGVudC5yZXBsYWNlKHJlZ2V4LCAobWF0Y2gpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQobWF0Y2gpLnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWOi+e8qVNWR1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNvbXByZXNzU1ZHKHN2Z0NvbnRlbnQ6IHN0cmluZywgbGV2ZWw6IG51bWJlcik6IHN0cmluZyB7XHJcbiAgICAgICAgLy8g566A5Y2V5Y6L57yp77ya56e76Zmk5aSa5L2Z56m655m9XHJcbiAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnQucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikucmVwbGFjZSgvPlxccys8L2csIFwiPjxcIikudHJpbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqU55So5LyY5YyW57uT5p6cXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXBwbHlPcHRpbWl6YXRpb24oc3ZnQ29udGVudDogc3RyaW5nLCByZXN1bHQ6IE9wdGltaXphdGlvblJlc3VsdCk6IHN0cmluZyB7XHJcbiAgICAgICAgLy8g6L+Z6YeM5bqU6K+l5qC55o2u5LyY5YyW57uT5p6c5bqU55So5YW35L2T5Y+Y5YyWXHJcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Y6f5aeL5YaF5a65XHJcbiAgICAgICAgcmV0dXJuIHN2Z0NvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bkvJjljJblj5jljJZcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBnZXRPcHRpbWl6YXRpb25DaGFuZ2VzKG9yaWdpbmFsOiBzdHJpbmcsIG9wdGltaXplZDogc3RyaW5nKTogc3RyaW5nW10ge1xyXG4gICAgICAgIGNvbnN0IGNoYW5nZXM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gICAgICAgIGlmIChvcmlnaW5hbC5sZW5ndGggIT09IG9wdGltaXplZC5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY2hhbmdlcy5wdXNoKGDlpKflsI86ICR7b3JpZ2luYWwubGVuZ3RofSAtPiAke29wdGltaXplZC5sZW5ndGh9IOWtl+iKgmApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g6L+Z6YeM5Y+v5Lul5re75Yqg5pu05aSa5Y+Y5YyW5qOA5rWLXHJcbiAgICAgICAgLy8g566A5YyW5a6e546w77ya6L+U5Zue5Z+65pys5Y+Y5YyWXHJcblxyXG4gICAgICAgIHJldHVybiBjaGFuZ2VzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5pu05paw5oCn6IO957uf6K6hXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgdXBkYXRlUGVyZm9ybWFuY2VTdGF0cyhyZXN1bHQ6IE9wdGltaXphdGlvblJlc3VsdCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbE9wdGltaXphdGlvbnMrKztcclxuICAgICAgICB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxSZWR1Y3Rpb24gKz0gcmVzdWx0LnJlZHVjdGlvblBlcmNlbnRhZ2U7XHJcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLnRvdGFsVGltZSArPSByZXN1bHQub3B0aW1pemF0aW9uVGltZTtcclxuXHJcbiAgICAgICAgLy8g6K6h566X5bmz5Z2H5YC8XHJcbiAgICAgICAgdGhpcy5wZXJmb3JtYW5jZVN0YXRzLmF2ZXJhZ2VSZWR1Y3Rpb24gPSB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxSZWR1Y3Rpb24gLyB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxPcHRpbWl6YXRpb25zO1xyXG4gICAgICAgIHRoaXMucGVyZm9ybWFuY2VTdGF0cy5hdmVyYWdlVGltZSA9IHRoaXMucGVyZm9ybWFuY2VTdGF0cy50b3RhbFRpbWUgLyB0aGlzLnBlcmZvcm1hbmNlU3RhdHMudG90YWxPcHRpbWl6YXRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LuO57K+54G15o+Q5Y+WU1ZHXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZXh0cmFjdFNWR0Zyb21TcHJpdGUoc3ByaXRlOiBTcHJpdGUpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgICAgICAvLyDov5nph4zpnIDopoHmoLnmja7lrp7pmYXpobnnm67nu5PmnoTmj5Dlj5ZTVkflhoXlrrlcclxuICAgICAgICAvLyDnroDljJblrp7njrDvvJrov5Tlm57nqbpcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiuoeeul+WFg+aVsOaNruWkp+Wwj1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNhbGN1bGF0ZU1ldGFkYXRhU2l6ZShzdmdDb250ZW50OiBzdHJpbmcpOiBudW1iZXIge1xyXG4gICAgICAgIGNvbnN0IG1ldGFkYXRhTWF0Y2ggPSBzdmdDb250ZW50Lm1hdGNoKC88bWV0YWRhdGE+W1xcc1xcU10qPzxcXC9tZXRhZGF0YT4vKTtcclxuICAgICAgICBjb25zdCBkZXNjTWF0Y2ggPSBzdmdDb250ZW50Lm1hdGNoKC88ZGVzYz5bXFxzXFxTXSo/PFxcL2Rlc2M+Lyk7XHJcbiAgICAgICAgY29uc3QgdGl0bGVNYXRjaCA9IHN2Z0NvbnRlbnQubWF0Y2goLzx0aXRsZT5bXFxzXFxTXSo/PFxcL3RpdGxlPi8pO1xyXG5cclxuICAgICAgICBsZXQgdG90YWxTaXplID0gMDtcclxuICAgICAgICBpZiAobWV0YWRhdGFNYXRjaCkgdG90YWxTaXplICs9IG1ldGFkYXRhTWF0Y2hbMF0ubGVuZ3RoO1xyXG4gICAgICAgIGlmIChkZXNjTWF0Y2gpIHRvdGFsU2l6ZSArPSBkZXNjTWF0Y2hbMF0ubGVuZ3RoO1xyXG4gICAgICAgIGlmICh0aXRsZU1hdGNoKSB0b3RhbFNpemUgKz0gdGl0bGVNYXRjaFswXS5sZW5ndGg7XHJcblxyXG4gICAgICAgIHJldHVybiB0b3RhbFNpemU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDorqHnrpfms6jph4rlpKflsI9cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVDb21tZW50U2l6ZShzdmdDb250ZW50OiBzdHJpbmcpOiBudW1iZXIge1xyXG4gICAgICAgIGNvbnN0IGNvbW1lbnRNYXRjaGVzID0gc3ZnQ29udGVudC5tYXRjaCgvPCEtLVtcXHNcXFNdKj8tLT4vZyk7XHJcbiAgICAgICAgaWYgKCFjb21tZW50TWF0Y2hlcykgcmV0dXJuIDA7XHJcblxyXG4gICAgICAgIHJldHVybiBjb21tZW50TWF0Y2hlcy5yZWR1Y2UoKHRvdGFsLCBjb21tZW50KSA9PiB0b3RhbCArIGNvbW1lbnQubGVuZ3RoLCAwKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS8sOeul+a9nOWcqOWHj+WwkVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGVzdGltYXRlUG90ZW50aWFsUmVkdWN0aW9uKGRhdGE6IHtcclxuICAgICAgICBzaXplOiBudW1iZXI7XHJcbiAgICAgICAgcGF0aENvdW50OiBudW1iZXI7XHJcbiAgICAgICAgY29sb3JDb3VudDogbnVtYmVyO1xyXG4gICAgICAgIG1ldGFkYXRhU2l6ZTogbnVtYmVyO1xyXG4gICAgICAgIGNvbW1lbnRTaXplOiBudW1iZXI7XHJcbiAgICB9KTogbnVtYmVyIHtcclxuICAgICAgICBsZXQgcG90ZW50aWFsUmVkdWN0aW9uID0gMDtcclxuXHJcbiAgICAgICAgLy8g5Z+65LqO5YWD5pWw5o2u55qE5YeP5bCRXHJcbiAgICAgICAgaWYgKGRhdGEubWV0YWRhdGFTaXplID4gMCkge1xyXG4gICAgICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gKGRhdGEubWV0YWRhdGFTaXplIC8gZGF0YS5zaXplKSAqIDEwMDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOWfuuS6juazqOmHiueahOWHj+WwkVxyXG4gICAgICAgIGlmIChkYXRhLmNvbW1lbnRTaXplID4gMCkge1xyXG4gICAgICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gKGRhdGEuY29tbWVudFNpemUgLyBkYXRhLnNpemUpICogMTAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5Z+65LqO6Lev5b6E5pWw6YeP55qE5YeP5bCR77yI5Lyw566X77yJXHJcbiAgICAgICAgaWYgKGRhdGEucGF0aENvdW50ID4gMTApIHtcclxuICAgICAgICAgICAgcG90ZW50aWFsUmVkdWN0aW9uICs9IE1hdGgubWluKDIwLCBkYXRhLnBhdGhDb3VudCAqIDAuNSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDln7rkuo7popzoibLmlbDph4/nmoTlh4/lsJHvvIjkvLDnrpfvvIlcclxuICAgICAgICBpZiAoZGF0YS5jb2xvckNvdW50ID4gOCkge1xyXG4gICAgICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gTWF0aC5taW4oMTUsIChkYXRhLmNvbG9yQ291bnQgLSA4KSAqIDEuNSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDljovnvKnmvZzliptcclxuICAgICAgICBwb3RlbnRpYWxSZWR1Y3Rpb24gKz0gMTA7IC8vIOWfuuacrOWOi+e8qVxyXG5cclxuICAgICAgICByZXR1cm4gTWF0aC5taW4oODAsIHBvdGVudGlhbFJlZHVjdGlvbik7IC8vIOacgOWkp+WHj+WwkTgwJVxyXG4gICAgfVxyXG59XHJcbiJdfQ==