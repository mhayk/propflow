import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersServiceController } from './work-orders-service.controller';
import { WorkOrdersServiceService } from './work-orders-service.service';

describe('WorkOrdersServiceController', () => {
  let workOrdersServiceController: WorkOrdersServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrdersServiceController],
      providers: [WorkOrdersServiceService],
    }).compile();

    workOrdersServiceController = app.get<WorkOrdersServiceController>(
      WorkOrdersServiceController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workOrdersServiceController.getHello()).toBe('Hello World!');
    });
  });
});
