import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Bill } from '../bills/entities/bill.entity';
import { Customer } from '../customers/entities/customer.entity';

/**
 *  Insight Field Note
 *  - totalSpent: calculate by multiply quantity and price from each billList item
 *  - totalPaid: calculate by addition all adjustmentList items with name "Gởi" and type "add"
 *  - totalDebt: calculate by subtract totalSpent and totalPaid
 *  - actualLatestBill: the debt from latest bill
 *  - hiddenPaid: list of paid items that not visible on bill
 *
 */

@Injectable()
export class InsightService {
  constructor(
    @InjectModel(Bill.name) private billModel: Model<Bill>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
  ) {}

  getGroupByStage(
    groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year',
    key = '_id',
  ) {
    const groupFields: any = {
      day: { $dayOfMonth: '$billDate' },
      month: { $month: '$billDate' },
      year: { $year: '$billDate' },
    };
    const groupAt: any = {
      day: `$${key}.day`,
      month: `$${key}.month`,
      year: `$${key}.year`,
    };
    switch (groupBy) {
      case 'week':
        groupFields.week = { $isoWeek: '$billDate' };
        groupAt.week = `$${key}.week`;
        delete groupAt.day;
        delete groupFields.day;
        break;
      case 'month':
        delete groupAt.day;
        delete groupFields.day;
        break;
      case 'quarter':
        groupFields.quarter = {
          $ceil: { $divide: [{ $month: '$billDate' }, 3] },
        };
        delete groupFields.day;
        delete groupAt.day;
        delete groupFields.month;
        delete groupAt.month;
        groupAt.quarter = `$${key}.quarter`;
        break;
      case 'year':
        delete groupFields.day;
        delete groupFields.month;
        delete groupAt.day;
        delete groupAt.month;
        break;
      default:
        break;
    }
    return {
      groupFields,
      groupAt,
    };
  }
  async getTopItemsByMonth(
    fromDate: Date,
    toDate: Date,
    sortBy: 'quantity' | 'revenue' = 'quantity',
    groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
    top?: number,
  ) {
    const sortField = sortBy === 'quantity' ? 'totalQuantity' : 'totalRevenue';
    const { groupFields, groupAt } = this.getGroupByStage(groupBy);
    // const groupFields: any = {
    //   day: { $dayOfMonth: '$billDate' },
    //   month: { $month: '$billDate' },
    //   year: { $year: '$billDate' },
    // };
    // const groupAt: any = {
    //   day: '$_id.day',
    //   month: '$_id.month',
    //   year: '$_id.year',
    // };

    // switch (groupBy) {
    //   case 'week':
    //     groupFields.week = { $isoWeek: '$billDate' };
    //     groupAt.week = '$_id.week';
    //     delete groupAt.day;
    //     delete groupFields.day;
    //     break;
    //   case 'month':
    //     delete groupAt.day;
    //     delete groupFields.day;
    //     break;
    //   case 'quarter':
    //     groupFields.quarter = {
    //       $ceil: { $divide: [{ $month: '$billDate' }, 3] },
    //     };
    //     delete groupFields.day;
    //     delete groupAt.day;
    //     delete groupFields.month;
    //     delete groupAt.month;
    //     groupAt.quarter = '$_id.quarter';
    //     break;
    //   case 'year':
    //     delete groupFields.day;
    //     delete groupFields.month;
    //     delete groupAt.day;
    //     delete groupAt.month;
    //     break;
    //   default:
    //     break;
    // }

    const pipeline: any[] = [
      {
        $match: { billDate: { $gte: fromDate, $lte: toDate }, deletedAt: null },
      },
      { $unwind: '$billList' },
      {
        $group: {
          _id: {
            itemName: '$billList.name',
            ...groupFields,
          },
          totalQuantity: { $sum: '$billList.quantity' },
          totalRevenue: { $sum: '$billList.total' },
        },
      },
      {
        $sort: { [sortField]: -1 },
      },
      {
        $group: {
          _id: { ...groupAt },
          items: {
            $push: {
              itemName: '$_id.itemName',
              totalQuantity: '$totalQuantity',
              totalRevenue: '$totalRevenue',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          ...(groupBy === 'week' && { week: '$_id.week' }),
          ...(groupBy === 'quarter' && { quarter: '$_id.quarter' }),
          ...(groupBy !== 'year' && { month: '$_id.month' }),
          ...(groupBy === 'day' && { day: '$_id.day' }),
          year: '$_id.year',
          items: top ? { $slice: ['$items', Number(top)] } : '$items',
        },
      },
      {
        $sort:
          groupBy === 'week'
            ? { year: -1, week: -1 }
            : groupBy === 'quarter'
            ? { year: -1, quarter: -1 }
            : groupBy === 'month'
            ? { year: -1, month: -1 }
            : { year: -1, month: -1, day: -1 },
      },
    ];

    return this.billModel.aggregate(pipeline).exec();
  }

  async getTopItems(
    from: Date,
    to: Date,
    sortBy: 'quantity' | 'revenue' = 'quantity',
    top?: number,
  ): Promise<any[]> {
    const sortField = sortBy === 'quantity' ? 'totalQuantity' : 'totalRevenue';
    return this.billModel
      .aggregate([
        {
          $match: {
            billDate: { $gt: from, $lt: to },
            deletedAt: null,
          },
        }, // Lọc theo khoảng thời gian
        { $unwind: '$billList' }, // Phân rã billList để tính từng món
        {
          $group: {
            _id: '$billList.name', // Nhóm theo tên món hàng
            totalBills: { $sum: 1 },
            totalQuantity: { $sum: '$billList.quantity' }, // Tổng số lượng món hàng
            totalRevenue: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            }, // Tính doanh thu
          },
        },
        {
          $sort: {
            [sortField]: -1,
          },
        },
        {
          $project: {
            _id: 0, // Remove the _id field from the result
            name: '$_id', // Rename _id to name
            totalQuantity: '$totalQuantity',
            totalRevenue: '$totalRevenue',
            totalBills: '$totalBills',
          },
        },
        {
          $limit: Number(top) || Number.MAX_SAFE_INTEGER, // Apply the top limit if provided
        },
      ])
      .exec();
  }

  async getCustomerOverview(
    customerId: string,
    from?: Date,
    to?: Date,
  ): Promise<any> {
    const matchStage: any = {
      customerId: new Types.ObjectId(customerId),
      deletedAt: null,
      ...(from && to && { billDate: { $gte: from, $lte: to } }), // Filter by date if from and to are provided
    };

    const customerBills = await this.billModel
      .aggregate([
        {
          $match: matchStage, // Apply date range filter here
        },
        { $unwind: '$billList' }, // Handle each billList item
        {
          $group: {
            _id: '$customerId',
            billCount: { $sum: 1 },
            totalSpent: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            },
          },
        },
      ])
      .exec();

    const customerPaid = await this.billModel
      .aggregate([
        {
          $match: matchStage, // Apply the same date range filter here
        },
        { $unwind: '$adjustmentList' },
        {
          $match: {
            'adjustmentList.name': 'Gởi',
            'adjustmentList.type': 'subtract',
          },
        },
        {
          $group: {
            _id: '$customerId',
            totalPaid: { $sum: '$adjustmentList.amount' },
          },
        },
      ])
      .exec();

    // Find the latest bill within the date range if applicable
    const latestBill = await this.billModel
      .findOne(matchStage)
      .sort({ billDate: -1, createdAt: -1 })
      .exec();

    const totalDebt = latestBill?.finalResult || 0;
    const totalPaid = customerPaid[0]?.totalPaid || 0;
    const totalSpent = customerBills[0]?.totalSpent || 0;
    const billCount = customerBills[0]?.billCount || 0;
    const totalResult = totalSpent - totalPaid;

    return {
      billCount,
      totalDebt,
      totalSpent,
      totalPaid,
      totalResult,
    };
  }

  async getCustomerOverviewByMonth(
    customerId: string,
    from?: Date,
    to?: Date,
  ): Promise<any> {
    const matchStage: any = {
      customerId: new Types.ObjectId(customerId),
      deletedAt: null,
      ...(from && to && { billDate: { $gte: from, $lte: to } }), // Filter by date if from and to are provided
    };

    const monthlyOverview = await this.billModel
      .aggregate([
        {
          $match: matchStage, // Apply date range filter here
        },
        { $unwind: '$billList' },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$billDate' },
              month: { $month: '$billDate' },
              year: { $year: '$billDate' },
            },
            billCount: { $sum: 1 },
            totalSpent: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            },
            latestBill: { $last: '$$ROOT' }, // Get the latest bill for each month
          },
        },
        {
          $lookup: {
            from: 'bills',
            localField: 'latestBill._id',
            foreignField: '_id',
            as: 'latestBillDetails',
          },
        },
        {
          $unwind: '$latestBillDetails',
        },
        {
          $addFields: {
            totalDebt: '$latestBillDetails.finalResult', // Use the finalResult of the latest bill as debt
          },
        },
        {
          $lookup: {
            from: 'bills',
            let: {
              customerId: '$customerId',
              billDate: '$latestBillDetails.billDate',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$customerId', '$$customerId'] },
                      { $lte: ['$billDate', '$$billDate'] },
                    ],
                  },
                },
              },
              { $unwind: '$adjustmentList' },
              {
                $match: {
                  'adjustmentList.name': 'Gởi',
                  'adjustmentList.type': 'subtract',
                },
              },
              {
                $group: {
                  _id: null,
                  totalPaid: { $sum: '$adjustmentList.amount' },
                },
              },
            ],
            as: 'totalPaidDetails',
          },
        },
        {
          $addFields: {
            totalPaid: {
              $ifNull: [
                { $arrayElemAt: ['$totalPaidDetails.totalPaid', 0] },
                0,
              ],
            },
            totalResult: {
              $subtract: [
                '$totalSpent',
                {
                  $ifNull: [
                    { $arrayElemAt: ['$totalPaidDetails.totalPaid', 0] },
                    0,
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            day: '$_id.day',
            month: '$_id.month',
            year: '$_id.year',
            billCount: 1,
            totalSpent: 1,
            totalDebt: 1,
            totalPaid: 1,
            totalResult: 1,
          },
        },
        {
          $sort: { year: 1, month: 1, day: 1 },
        },
      ])
      .exec();

    return monthlyOverview;
  }

  async getCustomerOverviewProduct(
    customerId: string,
    from?: string,
    to?: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Lọc theo khoảng thời gian nếu có
    const matchStage: any = {
      customerId: new Types.ObjectId(customerId),
      deletedAt: null,
      ...(!!from && !!to && { billDate: { $gte: fromDate, $lte: toDate } }),
    };

    // Lấy tổng số lượng sản phẩm mà khách hàng đã mua
    const totalQuantity = await this.billModel
      .aggregate([
        { $match: matchStage },
        { $unwind: '$billList' },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$billList.quantity' },
          },
        },
      ])
      .exec();

    // Chi tiêu trung bình trên mỗi hóa đơn
    const averageSpending = await this.billModel
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            averageSpending: { $avg: '$finalResult' },
          },
        },
      ])
      .exec();

    // Khoảng cách trung bình giữa mỗi đơn hàng
    const dateIntervals = await this.billModel
      .aggregate([
        { $match: matchStage },
        { $sort: { billDate: 1 } },
        {
          $group: {
            _id: null,
            dates: { $push: '$billDate' },
          },
        },
        {
          $project: {
            intervals: {
              $map: {
                input: { $range: [1, { $size: '$dates' }] },
                as: 'i',
                in: {
                  $subtract: [
                    { $arrayElemAt: ['$dates', '$$i'] },
                    { $arrayElemAt: ['$dates', { $subtract: ['$$i', 1] }] },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            averageInterval: {
              $avg: '$intervals',
            },
          },
        },
      ])
      .exec();

    // Xếp hạng sản phẩm mua nhiều nhất
    const productRanking = await this.billModel
      .aggregate([
        { $match: matchStage },
        { $unwind: '$billList' },
        {
          $group: {
            _id: '$billList.name',
            totalQuantity: { $sum: '$billList.quantity' },
          },
        },
        { $sort: { totalQuantity: -1 } },
      ])
      .exec();

    // Tần suất mua hàng của khách hàng
    const purchaseFrequency = await this.billModel
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            purchaseCount: { $count: {} },
          },
        },
      ])
      .exec();

    return {
      totalQuantity: totalQuantity[0]?.totalQuantity || 0,
      averageSpending: averageSpending[0]?.averageSpending || 0,
      averageInterval: dateIntervals[0]?.averageInterval || 0,
      productRanking,
      purchaseFrequency: purchaseFrequency[0]?.purchaseCount || 0,
    };
  }

  async getBillsWithItem(itemName: string) {
    return this.billModel
      .aggregate([
        { $match: { 'billList.name': itemName, deletedAt: null } }, // Lọc theo tên món hàng và đảm bảo chưa bị xóa
        {
          $unwind: '$billList', // Phân rã mảng billList
        },
        {
          $match: { 'billList.name': itemName }, // Lọc lại theo tên món hàng
        },
      ])
      .exec();
  }

  // 3. Tổng hợp doanh thu theo khoảng thời gian để vẽ biểu đồ (bar chart)
  async getRevenueForBarChart(from: Date, to: Date): Promise<any[]> {
    return this.billModel
      .aggregate([
        { $match: { billDate: { $gte: from, $lte: to }, deletedAt: null } }, // Lọc theo khoảng thời gian
        { $unwind: '$billList' }, // Phân rã billList để tính từng món
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$billDate' } }, // Nhóm theo ngày
            totalRevenue: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            }, // Tổng doanh thu
          },
        },
        { $sort: { _id: 1 } }, // Sắp xếp theo ngày tăng dần
      ])
      .exec();
  }

  // FINACE

  // async financeOverview(from: Date, to: Date): Promise<any> {
  //   const matchStage: any = {
  //     deletedAt: null,
  //     billDate: { $gte: from, $lte: to },
  //   };

  //   // Total Paid (sum of adjustmentList items with name "Gởi" and type "subtract")
  //   const totalPaid = await this.billModel
  //     .aggregate([
  //       { $match: matchStage },
  //       { $unwind: '$adjustmentList' },
  //       {
  //         $match: {
  //           'adjustmentList.name': 'Gởi',
  //           'adjustmentList.type': 'subtract',
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: null,
  //           totalPaid: { $sum: '$adjustmentList.amount' },
  //         },
  //       },
  //     ])
  //     .exec();

  //   // Total Spent (sum of quantity * price for all bill items)
  //   const totalSpent = await this.billModel
  //     .aggregate([
  //       { $match: matchStage },
  //       { $unwind: '$billList' },
  //       {
  //         $group: {
  //           _id: null,
  //           totalSpent: {
  //             $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
  //           },
  //         },
  //       },
  //     ])
  //     .exec();

  //   // Total Debt (sum of finalResult of the latest bill for each customer)
  //   const totalDebt = await this.billModel
  //     .aggregate([
  //       { $match: matchStage },
  //       {
  //         $group: {
  //           _id: '$customerId',
  //           latestBillDate: { $max: '$billDate' },
  //           finalResult: { $last: '$finalResult' },
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: null,
  //           totalDebt: { $sum: '$finalResult' },
  //         },
  //       },
  //     ])
  //     .exec();

  //   return {
  //     totalPaid: totalPaid[0]?.totalPaid || 0,
  //     totalSpent: totalSpent[0]?.totalSpent || 0,
  //     totalDebt: totalDebt[0]?.totalDebt || 0,
  //   };
  // }
  // async financeOverviewByMonth(from: Date, to: Date): Promise<any[]> {
  //   return this.billModel
  //     .aggregate([
  //       {
  //         $match: {
  //           billDate: { $gte: from, $lte: to },
  //           deletedAt: null,
  //         },
  //       },
  //       { $unwind: '$billList' },
  //       {
  //         $group: {
  //           _id: {
  //             month: { $month: '$billDate' },
  //             year: { $year: '$billDate' },
  //             customerId: '$customerId',
  //           },
  //           totalSpent: {
  //             $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
  //           },
  //           finalResult: { $last: '$finalResult' },
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: { month: '$_id.month', year: '$_id.year' },
  //           totalSpent: { $sum: '$totalSpent' },
  //           totalDebt: { $sum: '$finalResult' },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: 'bills',
  //           let: { month: '$_id.month', year: '$_id.year' },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: [{ $month: '$billDate' }, '$$month'] },
  //                     { $eq: [{ $year: '$billDate' }, '$$year'] },
  //                     { $eq: ['$deletedAt', null] },
  //                   ],
  //                 },
  //               },
  //             },
  //             { $unwind: '$adjustmentList' },
  //             {
  //               $match: {
  //                 'adjustmentList.name': 'Gởi',
  //                 'adjustmentList.type': 'subtract',
  //               },
  //             },
  //             {
  //               $group: {
  //                 _id: null,
  //                 totalPaid: { $sum: '$adjustmentList.amount' },
  //               },
  //             },
  //           ],
  //           as: 'paidInfo',
  //         },
  //       },
  //       {
  //         $addFields: {
  //           totalPaid: {
  //             $ifNull: [{ $arrayElemAt: ['$paidInfo.totalPaid', 0] }, 0],
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           month: '$_id.month',
  //           year: '$_id.year',
  //           totalSpent: 1,
  //           totalPaid: 1,
  //           totalDebt: { $subtract: ['$totalSpent', '$totalPaid'] },
  //           actualDebt: '$totalDebt',
  //           actualPaid: { $subtract: ['$totalSpent', '$totalDebt'] },
  //         },
  //       },
  //       { $sort: { year: 1, month: 1 } }, // Sort by year and month ascending
  //     ])
  //     .exec();
  // }

  //PIPELINE
  async getFinanceChartData(
    fromDate: Date,
    toDate: Date,
    groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
    customerId?: string,
  ): Promise<any[]> {
    const match = {
      ...(this.isValidDate(fromDate) &&
        this.isValidDate(toDate) && {
          billDate: { $gte: fromDate, $lte: toDate },
        }),
      ...(!!customerId && { customerId: new Types.ObjectId(customerId) }),
      deletedAt: null,
    };

    // Modify _id based on the period (groupBy)
    const { groupFields, groupAt } = this.getGroupByStage(groupBy);

    return this.billModel
      .aggregate([
        {
          $match: match,
        },
        {
          $sort: { billDate: -1, createdAt: -1 }, // Sort by billDate to get the latest bill
        },
        {
          $unwind: '$billList', // Unwind billList to work on individual bill items
        },
        {
          // Step 1: Group by the time period (day, week, etc.)
          $group: {
            _id: groupFields, // Period grouping
            bills: { $push: '$$ROOT' }, // Preserve full bill information for later grouping
          },
        },
        {
          $unwind: '$bills', // Unwind the bills for customer-specific calculations
        },
        {
          // Step 2: Group by customerId and get the latest bill for each customer
          $group: {
            _id: { customerId: '$bills.customerId', ...groupAt }, // Group by customerId
            latestBill: { $first: '$bills' }, // Get the latest bill for each customer
            totalSpent: {
              $sum: {
                $multiply: [
                  '$bills.billList.quantity',
                  '$bills.billList.price',
                ],
              },
            }, // Preserve totalSpent from previous step
          },
        },
        {
          $addFields: {
            actualLatestBillDebt: '$latestBill.finalResult', // Use latest bill's finalResult for actualBillDebt
          },
        },
        {
          // Lookup to get totalPaid by the customer
          $lookup: {
            from: 'bills',
            let: { customerId: '$_id.customerId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] },
                  deletedAt: null,
                },
              },
              { $unwind: '$adjustmentList' },
              {
                $match: {
                  'adjustmentList.name': 'Gởi',
                  'adjustmentList.type': 'subtract',
                },
              },
              {
                $group: {
                  _id: '$customerId',
                  totalPaid: { $sum: '$adjustmentList.amount' },
                },
              },
            ],
            as: 'paidInfo',
          },
        },
        {
          // Add fields for totalPaid and latest bill debt
          $addFields: {
            totalPaid: {
              $ifNull: [{ $arrayElemAt: ['$paidInfo.totalPaid', 0] }, 1],
            },
          },
        },
        {
          // Final grouping by period, summing up values across customers
          $group: {
            _id: groupAt, // Group by period (from previous step)
            totalSpent: { $sum: '$totalSpent' }, // Sum totalSpent across all customers
            totalPaid: { $sum: '$totalPaid' }, // Sum totalPaid across all customers
            actualBillDebt: { $sum: '$actualLatestBillDebt' }, // Sum actualBillDebt across all customers
          },
        },
        {
          // Project the final output
          $project: {
            _id: 0,
            ...(groupBy === 'week' && { week: '$_id.week' }),
            ...(groupBy === 'quarter' && { quarter: '$_id.quarter' }),
            ...(groupBy !== 'year' && { month: '$_id.month' }),
            ...(groupBy === 'day' && { day: '$_id.day' }),
            year: '$_id.year',
            totalSpent: 1,
            totalPaid: 1,
            actualBillDebt: 1,
          },
        },
        {
          $sort:
            groupBy === 'week'
              ? { year: -1, week: -1 }
              : groupBy === 'quarter'
              ? { year: -1, quarter: -1 }
              : groupBy === 'month'
              ? { year: -1, month: -1 }
              : { year: -1, month: -1, day: -1 },
        },
      ])
      .exec();
  }
  isValidDate(date: Date) {
    return date instanceof Date && !isNaN(date.getTime());
  }
  async getOverviewFinance(
    fromDate?: Date,
    toDate?: Date,
    customerId?: string,
  ): Promise<any> {
    const match = {
      ...(this.isValidDate(fromDate) &&
        this.isValidDate(toDate) && {
          billDate: { $gte: fromDate, $lte: toDate },
        }),
      ...(!!customerId && { customerId: new Types.ObjectId(customerId) }),
      deletedAt: null,
    };

    return this.billModel
      .aggregate([
        {
          $match: match,
        },
        {
          $sort: { billDate: -1, createdAt: -1 }, // Sort by billDate to get the latest bill
        },
        { $unwind: '$billList' },
        {
          $group: {
            _id: '$customerId', // Group by customerId
            billCount: { $sum: 1 },
            latestBill: { $first: '$$ROOT' }, // Get the latest bill for each customer
            totalSpent: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            }, // Calculate total spent
          },
        },
        {
          $lookup: {
            from: 'customers', // Join with the customers collection to get customer info
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
        {
          $lookup: {
            from: 'bills',
            let: { customerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] },
                  deletedAt: null,
                },
              },
              { $unwind: '$adjustmentList' },
              {
                $match: {
                  'adjustmentList.name': 'Gởi',
                  'adjustmentList.type': 'subtract',
                  'adjustmentList.amount': { $gt: 0 },
                },
              },
              {
                $group: {
                  _id: '$customerId',
                  totalPaid: { $sum: '$adjustmentList.amount' }, // Total paid from the adjustmentList
                },
              },
            ],
            as: 'paidInfo',
          },
        },
        {
          $addFields: {
            totalPaid: {
              $ifNull: [{ $arrayElemAt: ['$paidInfo.totalPaid', 0] }, 0],
            },

            actualLatestBillDebt: '$latestBill.finalResult', // Use finalResult from the latest bill as actualLatestBillDebt
          },
        },
        {
          $addFields: {
            totalDebt: { $subtract: ['$totalSpent', '$totalPaid'] }, // totalDebt = totalSpent - totalPaid
          },
        },
        // HiddenPaidList lookup
        {
          $lookup: {
            from: 'bills',
            let: { customerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] },
                  deletedAt: null,
                },
              },
              { $sort: { billDate: 1 } }, // Sort bills by date ascending for hiddenPaid calculation
              {
                $group: {
                  _id: null,
                  bills: {
                    $push: {
                      _id: '$_id',
                      billDate: '$billDate',
                      finalResult: { $ifNull: ['$finalResult', 0] }, // Default finalResult to 0 if null
                      adjustmentList: { $ifNull: ['$adjustmentList', []] }, // Default adjustmentList to empty array if null
                    },
                  },
                },
              },
              {
                $set: {
                  hiddenPaymentList: {
                    $reduce: {
                      input: { $range: [1, { $size: '$bills' }] }, // Start from the second bill (index 1)
                      initialValue: [],
                      in: {
                        $let: {
                          vars: {
                            currentBill: { $arrayElemAt: ['$bills', '$$this'] },
                            previousBill: {
                              $arrayElemAt: [
                                '$bills',
                                { $subtract: ['$$this', 1] },
                              ],
                            },
                          },
                          in: {
                            $let: {
                              vars: {
                                currentBillDebt: {
                                  $ifNull: [
                                    {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input:
                                              '$$currentBill.adjustmentList',
                                            as: 'adj',
                                            cond: {
                                              $and: [
                                                {
                                                  $eq: ['$$adj.name', 'Toa cũ'],
                                                },
                                                { $eq: ['$$adj.type', 'add'] },
                                              ],
                                            },
                                          },
                                        },
                                        0,
                                      ],
                                    },
                                    { amount: 0 }, // Default Toa cũ amount to 0 if not found
                                  ],
                                },
                              },
                              in: {
                                $cond: [
                                  {
                                    $ne: [
                                      {
                                        $subtract: [
                                          '$$previousBill.finalResult',
                                          '$$currentBillDebt.amount',
                                        ],
                                      },
                                      0,
                                    ], // Only include in results if the difference is not zero
                                  },
                                  {
                                    $concatArrays: [
                                      '$$value',
                                      [
                                        {
                                          currentBill: '$$currentBill._id',
                                          currentDate: '$$currentBill.billDate',
                                          currentBillDebt:
                                            '$$currentBillDebt.amount',
                                          previousBill: '$$previousBill._id',
                                          lastDate: '$$previousBill.billDate',
                                          lastFinalResult:
                                            '$$previousBill.finalResult',
                                          paid: {
                                            $subtract: [
                                              '$$previousBill.finalResult',
                                              '$$currentBillDebt.amount',
                                            ],
                                          },
                                        },
                                      ],
                                    ],
                                  },
                                  '$$value',
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            as: 'hiddenPaidInfo',
          },
        },
        {
          $addFields: {
            hiddenPaymentList: {
              $ifNull: [
                { $arrayElemAt: ['$hiddenPaidInfo.hiddenPaymentList', 0] },
                [],
              ],
            },
          },
        },
        {
          $addFields: {
            totalHiddenPayment: {
              $sum: '$hiddenPaymentList.paid',
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$totalSpent' },
            totalPaid: { $sum: '$totalPaid' },
            totalDebt: { $sum: '$totalDebt' },
            actualLatestBillDebt: { $sum: '$actualLatestBillDebt' },
            billCount: { $sum: '$billCount' },
            totalHiddenPayment: { $sum: '$totalHiddenPayment' },
            actualPaid: {
              $sum: {
                $add: ['$totalPaid', '$totalHiddenPayment'],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalSpent: 1,
            totalPaid: 1,
            totalDebt: 1,
            actualLatestBillDebt: 1,
            billCount: 1,
            hiddenPaymentList: 1,
            totalHiddenPayment: 1,
            actualPaid: 1,
          },
        },
      ])
      .exec();
  }

  async getCustomerRanking(
    from: Date,
    to: Date,
    sortBy: string = '+totalSpent',
    top?: number,
  ): Promise<any[]> {
    return this.billModel
      .aggregate([
        {
          $match: {
            billDate: { $gte: from, $lte: to },
            deletedAt: null,
          },
        },
        {
          $sort: { billDate: -1, createdAt: -1 }, // Sort by billDate to get the latest bill
        },
        { $unwind: '$billList' },
        {
          $group: {
            _id: '$customerId', // Group by customerId
            billCount: { $sum: 1 },
            latestBill: { $first: '$$ROOT' }, // Get the latest bill for each customer
            totalSpent: {
              $sum: { $multiply: ['$billList.quantity', '$billList.price'] },
            }, // Calculate total spent
          },
        },
        {
          $lookup: {
            from: 'customers', // Join with the customers collection to get customer info
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
        {
          $lookup: {
            from: 'bills',
            let: { customerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] },
                  deletedAt: null,
                },
              },
              { $unwind: '$adjustmentList' },
              {
                $match: {
                  'adjustmentList.name': 'Gởi',
                  'adjustmentList.type': 'subtract',
                  'adjustmentList.amount': { $gt: 0 },
                },
              },
              {
                $group: {
                  _id: '$customerId',
                  totalPaid: { $sum: '$adjustmentList.amount' }, // Total paid from the adjustmentList
                  paidList: {
                    $push: {
                      _id: '$_id', // Bill ID
                      billDate: '$billDate', // Bill date
                      amount: '$adjustmentList.amount', // Amount of 'Gởi'
                    },
                  },
                },
              },
            ],
            as: 'paidInfo',
          },
        },
        {
          $addFields: {
            totalPaid: {
              $ifNull: [{ $arrayElemAt: ['$paidInfo.totalPaid', 0] }, 0],
            },
            paidList: {
              $ifNull: [{ $arrayElemAt: ['$paidInfo.paidList', 0] }, []],
            },
            actualLatestBillDebt: '$latestBill.finalResult', // Use finalResult from the latest bill as actualLatestBillDebt
          },
        },
        {
          $addFields: {
            totalDebt: { $subtract: ['$totalSpent', '$totalPaid'] }, // totalDebt = totalSpent - totalPaid
          },
        },
        // HiddenPaidList lookup
        {
          $lookup: {
            from: 'bills',
            let: { customerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$customerId', '$$customerId'] },
                  deletedAt: null,
                },
              },
              { $sort: { billDate: 1 } }, // Sort bills by date ascending for hiddenPaid calculation
              {
                $group: {
                  _id: null,
                  bills: {
                    $push: {
                      _id: '$_id',
                      billDate: '$billDate',
                      finalResult: { $ifNull: ['$finalResult', 0] }, // Default finalResult to 0 if null
                      adjustmentList: { $ifNull: ['$adjustmentList', []] }, // Default adjustmentList to empty array if null
                    },
                  },
                },
              },
              {
                $set: {
                  hiddenPaymentList: {
                    $reduce: {
                      input: { $range: [1, { $size: '$bills' }] }, // Start from the second bill (index 1)
                      initialValue: [],
                      in: {
                        $let: {
                          vars: {
                            currentBill: { $arrayElemAt: ['$bills', '$$this'] },
                            previousBill: {
                              $arrayElemAt: [
                                '$bills',
                                { $subtract: ['$$this', 1] },
                              ],
                            },
                          },
                          in: {
                            $let: {
                              vars: {
                                currentBillDebt: {
                                  $ifNull: [
                                    {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input:
                                              '$$currentBill.adjustmentList',
                                            as: 'adj',
                                            cond: {
                                              $and: [
                                                {
                                                  $eq: ['$$adj.name', 'Toa cũ'],
                                                },
                                                { $eq: ['$$adj.type', 'add'] },
                                              ],
                                            },
                                          },
                                        },
                                        0,
                                      ],
                                    },
                                    { amount: 0 }, // Default Toa cũ amount to 0 if not found
                                  ],
                                },
                              },
                              in: {
                                $cond: [
                                  {
                                    $ne: [
                                      {
                                        $subtract: [
                                          '$$previousBill.finalResult',
                                          '$$currentBillDebt.amount',
                                        ],
                                      },
                                      0,
                                    ], // Only include in results if the difference is not zero
                                  },
                                  {
                                    $concatArrays: [
                                      '$$value',
                                      [
                                        {
                                          currentBill: '$$currentBill._id',
                                          currentDate: '$$currentBill.billDate',
                                          currentBillDebt:
                                            '$$currentBillDebt.amount',
                                          previousBill: '$$previousBill._id',
                                          lastDate: '$$previousBill.billDate',
                                          lastFinalResult:
                                            '$$previousBill.finalResult',
                                          paid: {
                                            $subtract: [
                                              '$$previousBill.finalResult',
                                              '$$currentBillDebt.amount',
                                            ],
                                          },
                                        },
                                      ],
                                    ],
                                  },
                                  '$$value',
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            as: 'hiddenPaidInfo',
          },
        },
        {
          $addFields: {
            hiddenPaymentList: {
              $ifNull: [
                { $arrayElemAt: ['$hiddenPaidInfo.hiddenPaymentList', 0] },
                [],
              ],
            },
          },
        },
        {
          $addFields: {
            totalHiddenPayment: {
              $sum: '$hiddenPaymentList.paid',
            },
          },
        },
        {
          $project: {
            _id: 0,
            customerId: '$_id',
            customerName: '$customer.name',
            totalSpent: 1,
            totalPaid: 1,
            totalDebt: 1, //calculated debt from existing value
            actualLatestBillDebt: 1, // From latestBill.finalResult
            paidList: 1, // Return paid list as required
            billCount: 1,
            hiddenPaymentList: 1, // Include the hidden paid list
            totalHiddenPayment: 1,
            actualPaid: {
              $sum: ['$totalPaid', '$totalHiddenPayment'],
            },
          },
        },
        {
          $limit: Number(top) || Number.MAX_SAFE_INTEGER, // Apply limit based on 'top' parameter
        },
      ])
      .sort(sortBy)
      .exec();
  }

  async getCustomerHiddenPaid(
    customerId = '66dd4708780ad1a15f00d9af',
    fromDate = new Date('2024-01-01T00:00:00.000Z'),
    toDate = new Date('2024-12-31T23:59:59.999'),
  ): Promise<any> {
    // Step 1: Match bills by customerId, date range, and ensure not deleted
    const matchCustomerBills: PipelineStage = {
      $match: {
        customerId: new Types.ObjectId(customerId),
        billDate: { $gte: fromDate, $lte: toDate },
        deletedAt: null,
      },
    };

    // Step 2: Sort bills by billDate ascending (oldest to newest)
    const sortBillsByDate: PipelineStage = { $sort: { billDate: 1 } };

    // Step 3: Group bills into an array for later processing
    const groupBills: PipelineStage = {
      $group: {
        _id: null,
        bills: {
          $push: {
            _id: '$_id',
            billDate: '$billDate',
            finalResult: { $ifNull: ['$finalResult', 0] }, // Default finalResult to 0 if null
            adjustmentList: { $ifNull: ['$adjustmentList', []] }, // Default adjustmentList to empty array if null
            customerName: '$customerName', // Assuming customerName is the same across all bills
          },
        },
      },
    };

    // Step 4: Calculate hidden paid amounts for each bill (from the second bill onward)
    const calculateHiddenPaid: PipelineStage = {
      $set: {
        results: {
          $reduce: {
            input: { $range: [1, { $size: '$bills' }] }, // Start from the second bill (index 1)
            initialValue: [],
            in: {
              $let: {
                vars: {
                  currentBill: { $arrayElemAt: ['$bills', '$$this'] },
                  previousBill: {
                    $arrayElemAt: ['$bills', { $subtract: ['$$this', 1] }],
                  },
                },
                in: {
                  $let: {
                    vars: {
                      currentToaCu: {
                        $ifNull: [
                          {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$$currentBill.adjustmentList',
                                  as: 'adj',
                                  cond: {
                                    $and: [
                                      { $eq: ['$$adj.name', 'Toa cũ'] },
                                      { $eq: ['$$adj.type', 'add'] },
                                    ],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                          { amount: 0 }, // Default Toa cũ amount to 0 if not found
                        ],
                      },
                    },
                    in: {
                      $cond: [
                        {
                          $ne: [
                            {
                              $subtract: [
                                '$$previousBill.finalResult',
                                '$$currentToaCu.amount',
                              ],
                            },
                            0,
                          ], // Only include in results if the difference is not zero
                        },
                        {
                          $concatArrays: [
                            '$$value',
                            [
                              {
                                currentDate: '$$currentBill.billDate',
                                currentToaCu: '$$currentToaCu.amount',
                                lastDate: '$$previousBill.billDate',
                                lastFinalResult: '$$previousBill.finalResult',
                                paid: {
                                  $subtract: [
                                    '$$previousBill.finalResult',
                                    '$$currentToaCu.amount',
                                  ],
                                },
                              },
                            ],
                          ],
                        },
                        '$$value',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    // Step 5: Project the final result with customer info
    const projectResults: PipelineStage = {
      $project: {
        _id: 0,
        customerId: customerId,
        customerName: { $first: '$bills.customerName' }, // Get the customerName from the first bill
        results: 1, // The calculated results
      },
    };

    // Combine all steps into the pipeline
    const pipeline: PipelineStage[] = [
      matchCustomerBills,
      sortBillsByDate,
      groupBills,
      calculateHiddenPaid,
      projectResults,
    ];

    return this.billModel.aggregate(pipeline).exec();
  }
}
