package com.example.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface PdksApiService {

    @POST("api/v1/auth/login")
    suspend fun login(
        @Body request: LoginRequestDto
    ): Response<LoginResponseDto>

    @POST("api/v1/attendance/record")
    suspend fun submitAttendanceRecord(
        @Body record: AttendanceRecordDto
    ): Response<SyncBatchResponseDto>

    @POST("api/v1/attendance/sync")
    suspend fun syncBatch(
        @Body request: SyncBatchRequestDto
    ): Response<SyncBatchResponseDto>

    @GET("api/v1/branches")
    suspend fun getBranches(): Response<List<BranchDto>>

    @GET("api/v1/attendance/records")
    suspend fun getEmployeeAttendanceRecords(
        @retrofit2.http.Query("employee_id") employeeId: Long
    ): Response<List<AttendanceRecordDto>>
}
