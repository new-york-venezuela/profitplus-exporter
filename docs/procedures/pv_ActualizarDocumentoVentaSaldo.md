# SP: pv_ActualizarDocumentoVentaSaldo
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	[pv_ActualizarDocumentoVentaSaldo]
*DESCRIPCIÓN	:	ACTUALIZAR EL SALDO DE UN DOCUMENTO DE VENTA DADO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 

CREATE PROCEDURE [dbo].[pv_ActualizarDocumentoVentaSaldo]
    (
      @sNro_Doc		CHAR(20),
      @sTipo_Doc	CHAR(20),
      @deSaldo		DECIMAL(18, 5),
      @sCo_Us_Mo	CHAR(6),
      @sCo_Sucu_Mo	CHAR(6),
      @sRevisado	CHAR(1)		=	NULL,
      @sTrasnfe		CHAR(1)		=	NULL,
      @sMaquina		VARCHAR(60) =	NULL
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in	DATETIME ,
              fe_us_mo	DATETIME ,
              rowguid	UNIQUEIDENTIFIER ,
              campo		VARCHAR(MAX)
            )		
		
        DECLARE @campo VARCHAR(MAX)
		
        UPDATE saDocumentoVenta
			SET saldo = saldo - @deSaldo, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
				OUTPUT
					Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid,
					'[saldo]=' + CAST(Deleted.saldo AS VARCHAR) + '->' + CAST(ISNULL(Inserted.saldo, 0) AS VARCHAR)
					INTO @TableTimestamp
				WHERE
					nro_doc = @sNro_Doc AND 
					co_tipo_doc = @sTipo_Doc
			
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid, @campo = campo
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @campo
			
    END
```
