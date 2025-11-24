import { Post } from './post.model';
import { Comment } from './comment.model';
import { Reaction } from './reaction.model';

// Gợi ý hooks cập nhật counters (gọi từ nơi khởi tạo models, tuỳ framework của bạn)
export function attachCounterHooks() {
  // Comment: tăng/giảm commentCount của Post
  Comment.watch().on('change', async (change) => {
    try {
      if (change.operationType === 'insert') {
        const postId = change.fullDocument.post;
        await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }).exec();
      }
      if (change.operationType === 'delete') {
        const postId = change.documentKey?._id; // không có postId trực tiếp khi delete qua change stream trừ khi full doc
        // Khuyến nghị: dùng middleware app level khi xoá để decrement chính xác
      }
    } catch (e) {
      // log error
    }
  });

  // Reaction: upsert bên app, nhưng nếu cần, có thể theo dõi thay đổi để cập nhật aggregates
  Reaction.watch().on('change', async (change) => {
    try {
      if (change.operationType === 'insert') {
        const { post, type } = change.fullDocument;
        await Post.updateOne(
          { _id: post },
          { $inc: { reactionCount: 1, [`reactionCounts.${type}`]: 1 } }
        ).exec();
      } else if (change.operationType === 'update') {
        const postId = change.updateDescription.updatedFields.post;
        const type = change.updateDescription.updatedFields.type;
        // Trường hợp đổi type: cần biết old type; khuyến nghị cập nhật counters ở tầng service thay vì dựa change stream
      } else if (change.operationType === 'delete') {
        // Tương tự comment, khuyến nghị cập nhật ở service khi xoá
      }
    } catch (e) {
      // log error
    }
  });
}