import { ZodError, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiResponse';

export const validate = (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (e) {
      const z = e as ZodError;
      next(new ApiError(400, 'Validation error', z.flatten()));
    }
  };
