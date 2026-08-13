# SP: pInsertarFacturaCompraImportacion
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarFacturaCompraImportacion
DESCRIPCION: Insertar Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarFacturaCompraImportacion]
    (
      @sNum_Plan_Impor CHAR(40) = NULL,
	  @sNum_Exp_Impor CHAR(40) = NULL,
	  @sCo_Incoterm CHAR(6) = NULL,
	  @sDoc_num CHAR(30),
	  @sCo_tipo_doc CHAR(6) ,
      @sLugarEmbarque CHAR(60) = NULL,
	  @sLugarDesembarque CHAR(60) = NULL,
	  @sEmpresaTransporte CHAR(60) = NULL,
	  @sDocumentacion CHAR(60) = NULL,
	  @sCondicionesSeguro CHAR(60) = NULL,
	  @sEmpaque CHAR(60) = NULL,
	  @sMarcas CHAR(60) = NULL,

      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;
    
        INSERT  INTO saFacturaCompraImportacion
                ( num_plan_impor, num_exp_impor, co_Incoterm, doc_num, co_tipo_doc, lugarEmbarque, lugarDesembarque, empresaTransporte, documentacion, condicionesSeguro, empaque, marcas,
				campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sNum_Plan_Impor, @sNum_Exp_Impor, @sCo_Incoterm, @sDoc_num, @sCo_tipo_doc, @sLugarEmbarque, @sLugarDesembarque, @sEmpresaTransporte, @sDocumentacion, @sCondicionesSeguro, @sEmpaque, @sMarcas,
				@sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5,
                  @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
```
