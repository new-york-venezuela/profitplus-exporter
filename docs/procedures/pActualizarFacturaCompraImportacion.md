# SP: pActualizarFacturaCompraImportacion
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarFacturaCompraImportacion
DESCRIPCION: Actualiza Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarFacturaCompraImportacion]
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
	
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
    
        UPDATE
            saFacturaCompraImportacion
        SET num_plan_impor = @sNum_Plan_Impor, num_exp_impor = @sNum_Exp_Impor, co_incoterm = @sCo_Incoterm, lugarEmbarque = @sLugarEmbarque, lugarDesembarque = @sLugarDesembarque,
			empresaTransporte = @sEmpresaTransporte, documentacion = @sDocumentacion, condicionesSeguro = @sCondicionesSeguro, empaque = @sEmpaque, marcas = @sMarcas,
		    campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
```
