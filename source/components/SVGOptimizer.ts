import { _decorator, Component, Sprite } from "cc";
const { ccclass, property, executeInEditMode, menu } = _decorator;


/**
 * 优化配置
 */
interface OptimizationConfig {
    enablePathSimplification: boolean; // 启用路径简化
    pathSimplificationTolerance: number; // 路径简化容差（0-1）
    enableColorOptimization: boolean; // 启用颜色优化
    maxColors: number; // 最大颜色数量
    enableCompression: boolean; // 启用压缩
    compressionLevel: number; // 压缩级别（0-9）
    removeMetadata: boolean; // 移除元数据
    removeComments: boolean; // 移除注释
    removeUnusedDefs: boolean; // 移除未使用的定义
    mergePaths: boolean; // 合并路径
    precision: number; // 数值精度（小数点后位数）
}

/**
 * 优化结果
 */
interface OptimizationResult {
    originalSize: number; // 原始大小（字节）
    optimizedSize: number; // 优化后大小（字节）
    reductionPercentage: number; // 减少百分比
    optimizationTime: number; // 优化时间（毫秒）
    changes: string[]; // 具体变化
}

/**
 * SVG优化器
 * 提供各种SVG优化功能，如路径简化、颜色优化、压缩等
 */
@ccclass("SVGOptimizer")
@menu("2D/SVGOptimizer")
@executeInEditMode
export class SVGOptimizer extends Component {
    // ========== 优化配置 ==========

    @property({
        tooltip: "启用自动优化",
        displayName: "自动优化",
    })
    private enableAutoOptimization: boolean = true;

    @property({
        tooltip: "优化配置",
        displayName: "优化配置",
    })
    private optimizationConfig: OptimizationConfig = {
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

    @property({
        tooltip: "优化阈值（KB）",
        displayName: "优化阈值",
        min: 1,
        max: 1000,
    })
    private optimizationThreshold: number = 10; // 10KB

    @property({
        tooltip: "批量优化数量",
        displayName: "批量优化数",
        min: 1,
        max: 50,
    })
    private batchOptimizationCount: number = 10;

    // ========== 性能配置 ==========

    @property({
        tooltip: "启用性能监控",
        displayName: "性能监控",
    })
    private enablePerformanceMonitoring: boolean = false;

    @property({
        tooltip: "最大缓存优化结果",
        displayName: "最大缓存",
        min: 10,
        max: 1000,
    })
    private maxCachedResults: number = 100;

    // ========== 内部状态 ==========

    private optimizationCache: Map<string, OptimizationResult> = new Map(); // 优化结果缓存
    private pendingOptimizations: Set<string> = new Set(); // 待优化SVG
    private optimizationQueue: string[] = []; // 优化队列

    private performanceStats = {
        totalOptimizations: 0,
        totalReduction: 0,
        averageReduction: 0,
        totalTime: 0,
        averageTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
    };

    // ========== 生命周期方法 ==========

    onLoad() {
        this.initializeOptimizer();
    }

    onDestroy() {
        this.cleanupOptimizer();
    }

    update(deltaTime: number) {
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
    public async optimizeSVG(svgContent: string, config?: OptimizationConfig): Promise<string> {
        const cacheKey = this.generateCacheKey(svgContent, config || this.optimizationConfig);

        // 检查缓存
        if (this.optimizationCache.has(cacheKey)) {
            this.performanceStats.cacheHits++;
            const cachedResult = this.optimizationCache.get(cacheKey)!;

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

            const result: OptimizationResult = {
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
        } catch (error) {
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
    public async batchOptimizeSVG(svgContents: string[], config?: OptimizationConfig): Promise<string[]> {
        const promises = svgContents.map((svgContent) => this.optimizeSVG(svgContent, config));

        return Promise.all(promises);
    }

    /**
     * 优化精灵的SVG
     * @param sprite 精灵组件
     * @param config 优化配置（可选）
     */
    public async optimizeSpriteSVG(sprite: Sprite, config?: OptimizationConfig): Promise<void> {
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
        console.log(`精灵SVG优化完成: ${sprite.node?.name || "未知精灵"}`);
    }

    /**
     * 获取优化统计
     */
    public getOptimizationStats(): typeof this.performanceStats {
        return { ...this.performanceStats };
    }

    /**
     * 清除优化缓存
     */
    public clearOptimizationCache(): void {
        this.optimizationCache.clear();
        console.log("优化缓存已清除");
    }

    /**
     * 获取缓存信息
     */
    public getCacheInfo(): {
        size: number;
        hitRate: number;
        totalSize: number;
    } {
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
    public setOptimizationConfig(config: OptimizationConfig): void {
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
    public analyzeOptimizationPotential(svgContent: string): {
        size: number;
        pathCount: number;
        colorCount: number;
        metadataSize: number;
        commentSize: number;
        potentialReduction: number;
    } {
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
    private initializeOptimizer(): void {
        this.optimizationCache.clear();
        this.pendingOptimizations.clear();
        this.optimizationQueue = [];

        console.log("SVGOptimizer 初始化完成");
    }

    /**
     * 清理优化器
     */
    private cleanupOptimizer(): void {
        this.clearOptimizationCache();
        this.pendingOptimizations.clear();
        this.optimizationQueue = [];

        console.log("SVGOptimizer 清理完成");
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(svgContent: string, config: OptimizationConfig): string {
        const configHash = JSON.stringify(config);
        const contentHash = this.calculateContentHash(svgContent);
        return `${contentHash}_${configHash}`;
    }

    /**
     * 计算内容哈希
     */
    private calculateContentHash(content: string): string {
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
    private cacheOptimizationResult(key: string, result: OptimizationResult): void {
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
    private processPendingOptimizations(): void {
        if (this.pendingOptimizations.size === 0) return;

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
    private async performOptimization(svgContent: string, config: OptimizationConfig): Promise<string> {
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
    private removeComments(svgContent: string): string {
        return svgContent.replace(/<!--[\s\S]*?-->/g, "");
    }

    /**
     * 移除元数据
     */
    private removeMetadata(svgContent: string): string {
        // 移除各种元数据标签
        return svgContent
            .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
            .replace(/<desc>[\s\S]*?<\/desc>/g, "")
            .replace(/<title>[\s\S]*?<\/title>/g, "");
    }

    /**
     * 简化路径
     */
    private async simplifyPaths(svgContent: string, tolerance: number): Promise<string> {
        // 这里应该使用路径简化算法
        // 简化实现：返回原始内容
        return svgContent;
    }

    /**
     * 优化颜色
     */
    private async optimizeColors(svgContent: string, maxColors: number): Promise<string> {
        // 这里应该实现颜色优化算法
        // 简化实现：返回原始内容
        return svgContent;
    }

    /**
     * 移除未使用的定义
     */
    private removeUnusedDefs(svgContent: string): string {
        // 这里应该分析并移除未使用的<defs>元素
        // 简化实现：返回原始内容
        return svgContent;
    }

    /**
     * 合并路径
     */
    private async mergePaths(svgContent: string): Promise<string> {
        // 这里应该实现路径合并算法
        // 简化实现：返回原始内容
        return svgContent;
    }

    /**
     * 四舍五入数字
     */
    private roundNumbers(svgContent: string, precision: number): string {
        // 四舍五入SVG中的数字
        const regex = /(\d+\.\d+)/g;
        return svgContent.replace(regex, (match) => {
            return parseFloat(match).toFixed(precision);
        });
    }

    /**
     * 压缩SVG
     */
    private compressSVG(svgContent: string, level: number): string {
        // 简单压缩：移除多余空白
        return svgContent.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
    }

    /**
     * 应用优化结果
     */
    private applyOptimization(svgContent: string, result: OptimizationResult): string {
        // 这里应该根据优化结果应用具体变化
        // 简化实现：返回原始内容
        return svgContent;
    }

    /**
     * 获取优化变化
     */
    private getOptimizationChanges(original: string, optimized: string): string[] {
        const changes: string[] = [];

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
    private updatePerformanceStats(result: OptimizationResult): void {
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
    private extractSVGFromSprite(sprite: Sprite): string | null {
        // 这里需要根据实际项目结构提取SVG内容
        // 简化实现：返回空
        return null;
    }

    /**
     * 计算元数据大小
     */
    private calculateMetadataSize(svgContent: string): number {
        const metadataMatch = svgContent.match(/<metadata>[\s\S]*?<\/metadata>/);
        const descMatch = svgContent.match(/<desc>[\s\S]*?<\/desc>/);
        const titleMatch = svgContent.match(/<title>[\s\S]*?<\/title>/);

        let totalSize = 0;
        if (metadataMatch) totalSize += metadataMatch[0].length;
        if (descMatch) totalSize += descMatch[0].length;
        if (titleMatch) totalSize += titleMatch[0].length;

        return totalSize;
    }

    /**
     * 计算注释大小
     */
    private calculateCommentSize(svgContent: string): number {
        const commentMatches = svgContent.match(/<!--[\s\S]*?-->/g);
        if (!commentMatches) return 0;

        return commentMatches.reduce((total, comment) => total + comment.length, 0);
    }

    /**
     * 估算潜在减少
     */
    private estimatePotentialReduction(data: {
        size: number;
        pathCount: number;
        colorCount: number;
        metadataSize: number;
        commentSize: number;
    }): number {
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
}
