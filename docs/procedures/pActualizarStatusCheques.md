# SP: pActualizarStatusCheques
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCheque`](../tables/saCheque.md)
- [`saChequera`](../tables/saChequera.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pActualizarStatusCheques]
    (
      @sCo_Cheq					CHAR(20) ,
      @sCo_Cta					CHAR(6) ,
      @EmiVsDisVsAnu			INT , -- 1 EMITIDO, 2 DISPONIBLE, 3 ANULADO, 4 REACTIVAR (EMITIDO)
      @tsMarcaTiempoCheque		TIMESTAMP ,
      @sNumMov					CHAR(20)	= NULL ,
	  @sMaquina					VARCHAR(60) = NULL ,
      @sCo_Us_Mo				CHAR(6) ,
      @sCo_Sucu_Mo				CHAR(6)
    )
AS 
    BEGIN

        DECLARE @TableTimestampCheque TABLE
            (
              validador		VARBINARY(MAX),
              fe_us_in		DATETIME ,
              fe_us_mo		DATETIME,
			  estatusOld	CHAR(3),
			  estatusNew	CHAR(3),
			  rowGuid		UNIQUEIDENTIFIER
            )

		DECLARE @TableTimestampChequera TABLE
            (
              validador		VARBINARY(MAX),
              fe_us_in		DATETIME ,
              fe_us_mo		DATETIME,
			  estatusOld	CHAR(3),
			  estatusNew	CHAR(3),
			  rowGuid		UNIQUEIDENTIFIER
            )

        DECLARE @sCodigoChequera		CHAR(20)	--CODIGO DE LA CHEQUERA
        DECLARE @sStatusCheque			CHAR(3)		--STATUS ACTUAL DEL CHEQUE
        DECLARE @sNumeroCheque			CHAR(20)	-- NUMERO DEL CHEQUE
        DECLARE @sStatus				CHAR(3)		-- STATUS AL CUAL SE VA A MODIFICAR EL CHEQUE
        DECLARE @sNumMovActual			CHAR(20)	-- MOVIMIENTO ACTUAL QUE POSEE EL CHEQUE
        DECLARE @sStatusChequera		CHAR(3)		-- STATUS ACTUAL DE LA CHEQUERA
        DECLARE @cantidadCheques		INT			--CAMPO USADO PARA OBTENER LA CANTIDAD DE CHEQUES DISPONIBLES
		DECLARE @MarcaTiempoChequebd	TIMESTAMP
		
		--OBTENGO LOS DATOS DE CHEQUE Y CHEQUERA
		SELECT
            @sCodigoChequera = ch.Co_Chra, @sStatusCheque = ch.status, @sNumeroCheque = chra.num_ch,
            @sNumMovActual = ch.mov_num, @sStatusChequera = chra.status, @MarcaTiempoChequebd = ch.validador
        FROM
            saChequera AS chra
            INNER JOIN saCheque AS ch ON chra.Co_Chra = ch.Co_Chra
                                         AND ch.Co_Cheq = @sCo_Cheq
        WHERE
            chra.cod_cta = @sCo_Cta
		
		--RESTRICCIONES
		declare @strError VARCHAR(512)
		IF((@sNumMovActual IS NOT NULL OR @EmiVsDisVsAnu != 2) AND @MarcaTiempoChequebd != @tsMarcaTiempoCheque)
		BEGIN
				
				set @strError = 'No es posible marcar como emitido el cheque ' + LTRIM(RTRIM(@sCo_Cheq)) 
							+ ' de la cuenta ' + RTRIM(LTRIM(@sCo_Cta)) + ' ha sido modificado.'
                            RAISERROR(@strError,16,1)
		END
		IF ( @EmiVsDisVsAnu = 1 and
```
