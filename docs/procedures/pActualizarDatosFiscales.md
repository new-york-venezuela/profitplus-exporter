# SP: pActualizarDatosFiscales
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`pvFacturaVentaExt`](../tables/pvFacturaVentaExt.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saFacturaVenta`](../tables/saFacturaVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pActualizarDatosFiscales]
*DESCRIPCIÓN	:	INSERTA UN REGISTRO EN LA TABLA EXTENDIDA DE DEVOLUCION DE CLIENTE
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 

CREATE PROCEDURE [dbo].[pActualizarDatosFiscales]
    (
      @sNro_doc CHAR(20) ,
	  @sCo_Tipo_Doc CHAR(6) ,
      @sImpfis VARCHAR(20) = NULL ,
      @sImpfisfac VARCHAR(15) = NULL ,
      @sImp_nro_z CHAR(15) = NULL, 
	  @sCo_us_mo CHAR(6) ,
      @sco_sucu_mo CHAR(6) ,	  
      @sMaquina VARCHAR(60) = NULL ,
      @tsValidador TIMESTAMP = null,
      @gRowguid UNIQUEIDENTIFIER = null,
	  @bActualizarTablaExt BIT 
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
		
		DECLARE @TableTimestampTablaExt TABLE
        (
          validador VARBINARY(MAX) ,
          fe_us_in DATETIME ,
          fe_us_mo DATETIME ,
          rowguid UNIQUEIDENTIFIER
        )
		DECLARE @sImpfisOld VARCHAR(20) = NULL 
		DECLARE @sImpfisfacOld VARCHAR(15) = NULL 
		DECLARE @sImp_nro_zOld CHAR(15) = NULL
		DECLARE @rowguidFact uniqueidentifier

		select @sImpfisOld = isnull(DV.Impfis,'null'), @sImpfisfacOld=isnull(DV.Impfisfac,'null'), @sImp_nro_zOld=isnull(DV.imp_nro_z,'null') , 
		@rowguidFact = FV.rowguid --Rowguid para pvFacturaVentaExt

		  FROM saDocumentoVenta DV
		  LEFT JOIN saFacturaVenta FV ON DV.nro_doc = FV.doc_num AND DV.co_tipo_doc = 'FACT'
		 WHERE
            DV.co_tipo_doc = @sCo_Tipo_Doc  
			AND DV.nro_doc = @sNro_doc

        UPDATE
            saDocumentoVenta
        SET  Impfis = @sImpfis, Impfisfac = @sImpfisfac, imp_nro_z = @sImp_nro_z, 
            Co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, Fe_us_mo = GETDATE()      
        OUTPUT
            Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tipo_doc = @sCo_Tipo_Doc  
			 AND nro_doc = @sNro_doc

		IF(@bActualizarTablaExt = 1 ) --Actualización de Tabla FacturaVentaExt
			BEGIN
			EXEC pActualizarTablaFacturaVentaExt
			@rowguidFact = @rowguidFact,
		    @bActualizarTablaExt = 1,
            @sCo_Us_Mo = @sCo_us_mo,
            @sCo_Sucu_Mo = @sco_sucu_mo,
            @sMaquina = @sMaquina;
```
