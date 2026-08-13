# SP: pInsertarPlantillaCompraReq
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarCompraReq
*DESCRIPCIÓN	: Inserta un registro en saPlantillaCompraReq
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarPlantillaCompraReq]
    (
		   @gRowguid_Plantilla_Compra uniqueidentifier,
           @sCo_Ubicacion char(6),
           @sAutorizado char(128),
           @sDescripcion char(128),
           @sResponsable char(128),
           @sEmail char(128),
		   @dFecha DateTime,
		   @sEstatus char(2),
		   @sTelefono char(128),
		   @sDireccion char(512),
           @sCampo1 varchar(60),
           @sCampo2 varchar(60),
           @sCampo3 varchar(60),
           @sCampo4 varchar(60),
           @sCampo5 varchar(60),
           @sCampo6 varchar(60),
           @sCampo7 varchar(60),
           @sCampo8 varchar(60),
           @sCo_Us_In char(6),
           @sCo_Sucu_In char(6),
           --@dFe_Us_In datetime,
           --@sCo_Us_Mo char(6),
           --@sCo_Sucu_Mo char(6),
           --@dFe_Us_Mo datetime,
           @sRevisado char(1),
           @sTrasnfe char(1),
		   @sMaquina VARCHAR(60)
           --,<rowguid uniqueidentifier
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT INTO dbo.saPlantillaCompraReq
           (rowguid_plantilla_compra
           ,co_ubicacion
           ,autorizado
           ,descripcion
           ,responsable
		   ,Email
		   ,fecha
		   ,Estatus 
		   ,Telefono 
		   ,Direccion 
           ,co_us_in
           ,co_sucu_in
           ,fe_us_in
           ,co_us_mo
           ,co_sucu_mo
           ,fe_us_mo
           ,revisado
           ,trasnfe
           )
     
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
           (@gRowguid_Plantilla_Compra,
           @sCo_Ubicacion,
           @sAutorizado, 
           @sDescripcion, 
           @sResponsable, 
           @sEmail, 
		   @dFecha,
		   @sEstatus,
		   @sTelefono,
		   @sDireccion,
           @sCo_us_in, 
           @sCo_sucu_in, 
           GETDATE(), 
           @sCo_Us_In, 
           @sCo_Sucu_I
```
