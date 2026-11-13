import e from "express";
import { PopulateOptions, ProjectionType } from "mongoose";
import { Model, QueryFilter, QueryOptions } from "mongoose";



export abstract class DBRepository<T> {
    constructor(protected readonly model: Model<T>) { }

      create = async( data:Partial<T>) => {
    return await this.model.create([data])
}

  findOne = async({ filter, projection, options }:{
    filter:QueryFilter<T>, 
    projection?: ProjectionType<T> ,
    options?: QueryOptions<T>
  }) => {
    return await this.model.findOne(filter, projection, options)
}

  find = async({ filter, options = {}}:{
    filter:QueryFilter<T>, 
    options?: QueryOptions<T>
  }) => {
      let data = this.model.find(filter)
     if(options?.limit) data = data.limit(options?.limit)
     if(options?.skip) data = data.skip(options?.skip)
     if(options?.sort) data = data.sort(options?.sort)
     if(options?.select) data = data.select(options?.select)
     if(options?.populate) data = data.populate(options?.populate as PopulateOptions)
   
    return await data.exec()
}

  findById = async({ id, options = {}}:{
    id: string,
    options: QueryOptions<T>
  }) => {
    return await this.model.findById(id, options)
}

  findByIdAndUpdate = async({ id, update, options = {}}:{
    id: string,
    update: Partial<T>,
    options: QueryOptions<T>
  }) => {
    return await this.model.findByIdAndUpdate(id, update, {new: true,runValidators: true, ...options})
}

  findOneAndUpdate = async ({ filter, update, options = {} }: {
    filter: QueryFilter<T>,
    update: Partial<T>,
    options: QueryOptions<T>
  }) => {
    return await this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true, ...options })
}

  findOneAndDelete = async ({ filter}: {
    filter: QueryFilter<T>
  }) => {
    return await this.model.findOneAndDelete(filter)
}

}

export default DBRepository