import { Plan, IPlan, BillingInterval } from '../models/plan.model';
import { ApiError } from '../utils/apiResponse';

export interface CreatePlanData {
  code: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  interval: BillingInterval;
  intervalCount?: number;
  trialDays?: number;
  features?: Record<string, any>;
  isActive?: boolean;
  providerMetadata?: Record<string, any>;
}

class PlanService {
  /**
   * Tạo Plan mới
   * @param planData - Dữ liệu Plan cần tạo
   * @returns Plan đã được tạo
   * @throws ApiError nếu validation thất bại hoặc code đã tồn tại
   */
  async createPlan(planData: CreatePlanData): Promise<IPlan> {
    // Kiểm tra code đã tồn tại chưa
    const existingPlan = await Plan.findOne({ code: planData.code });
    if (existingPlan) {
      throw new ApiError(400, `Plan with code "${planData.code}" already exists`);
    }

    // Tạo Plan mới
    const newPlan = await Plan.create({
      code: planData.code,
      name: planData.name,
      description: planData.description,
      price: planData.price,
      currency: planData.currency || 'VND',
      interval: planData.interval,
      intervalCount: planData.intervalCount || 1,
      trialDays: planData.trialDays || 0,
      features: planData.features || {},
      isActive: planData.isActive !== undefined ? planData.isActive : true,
      providerMetadata: planData.providerMetadata || {},
    });

    return newPlan;
  }

  /**
   * Lấy danh sách các Plan đang hoạt động (công khai)
   * Chỉ trả về các trường công khai: name, price, features
   * @returns Danh sách các plan có isActive: true, chỉ với các trường công khai
   */
  async getAvailablePlans() {
    const plans = await Plan.find({ isActive: true })
      .select('name price features')
      .sort({ price: 1 }) // Sắp xếp theo giá tăng dần
      .lean();

    // Chỉ trả về các trường công khai theo yêu cầu: name, price, features
    return plans.map((plan) => ({
      name: plan.name,
      price: plan.price,
      features: plan.features,
    }));
  }

  /**
   * Cập nhật Plan
   * @param planId - ID của Plan cần cập nhật
   * @param updateData - Dữ liệu cần cập nhật
   * @returns Plan đã được cập nhật
   * @throws ApiError nếu Plan không tồn tại hoặc code đã tồn tại
   */
  async updatePlan(planId: string, updateData: Partial<CreatePlanData>): Promise<IPlan> {
    // Tìm Plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, 'Plan not found');
    }

    // Nếu có code mới, kiểm tra code đã tồn tại chưa (trừ chính plan hiện tại)
    if (updateData.code && updateData.code !== plan.code) {
      const existingPlan = await Plan.findOne({ code: updateData.code, _id: { $ne: planId } });
      if (existingPlan) {
        throw new ApiError(400, `Plan with code "${updateData.code}" already exists`);
      }
    }

    // Cập nhật các trường
    if (updateData.code !== undefined) plan.code = updateData.code.trim();
    if (updateData.name !== undefined) plan.name = updateData.name.trim();
    if (updateData.description !== undefined) plan.description = updateData.description?.trim();
    if (updateData.price !== undefined) plan.price = updateData.price;
    if (updateData.currency !== undefined) plan.currency = updateData.currency;
    if (updateData.interval !== undefined) plan.interval = updateData.interval;
    if (updateData.intervalCount !== undefined) plan.intervalCount = updateData.intervalCount;
    if (updateData.trialDays !== undefined) plan.trialDays = updateData.trialDays;
    if (updateData.features !== undefined) plan.features = updateData.features;
    if (updateData.isActive !== undefined) plan.isActive = updateData.isActive;
    if (updateData.providerMetadata !== undefined) plan.providerMetadata = updateData.providerMetadata;

    await plan.save();
    return plan;
  }

  /**
   * Vô hiệu hóa Plan (soft delete - set isActive: false)
   * @param planId - ID của Plan cần vô hiệu hóa
   * @returns Plan đã được vô hiệu hóa
   * @throws ApiError nếu Plan không tồn tại
   */
  async deactivatePlan(planId: string): Promise<IPlan> {
    // Tìm Plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, 'Plan not found');
    }

    // Set isActive = false
    plan.isActive = false;
    await plan.save();

    return plan;
  }

  /**
   * Kích hoạt lại Plan (set isActive: true)
   * @param planId - ID của Plan cần kích hoạt
   * @returns Plan đã được kích hoạt
   * @throws ApiError nếu Plan không tồn tại
   */
  async activatePlan(planId: string): Promise<IPlan> {
    // Tìm Plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new ApiError(404, 'Plan not found');
    }

    // Set isActive = true
    plan.isActive = true;
    await plan.save();

    return plan;
  }
}

export const planService = new PlanService();

